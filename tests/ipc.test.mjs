import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("concurrent local image requests receive their own out-of-order replies", async () => {
  const handlers = new Map();
  const pending = new Map();
  let bridge;
  const electron = {
    ipcMain: { on() {}, handle: (channel, fn) => handlers.set(channel, fn) },
    ipcRenderer: { send() {}, invoke: (channel, ...args) => handlers.get(channel)({}, ...args) },
    contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
  };
  const common = { console: { log() {}, error() {} }, setTimeout, clearTimeout, Buffer };
  vm.runInNewContext(await readFile(new URL("../src/main/index.js", import.meta.url), "utf8"), {
    ...common, require: name => {
      if (name === "electron") return electron;
      if (name === "fs") return {};
      if (name === "fs/promises") return { readFile: path => new Promise((resolve, reject) => pending.set(path, { resolve, reject })) };
      if (name === "path") return { resolve: p => p, extname: p => p.slice(p.lastIndexOf(".")) };
      throw new Error(name);
    },
  });
  vm.runInNewContext(await readFile(new URL("../src/preload/index.js", import.meta.url), "utf8"), {
    ...common, require: () => electron,
  });
  const a = bridge.readLocalImage("a.png");
  const b = bridge.readLocalImage("b.jpg");
  const missing = bridge.readLocalImage("missing.png");
  pending.get("b.jpg").resolve(Buffer.from("second"));
  pending.get("missing.png").reject(new Error("ENOENT"));
  pending.get("a.png").resolve(Buffer.from("first"));
  assert.equal((await a).dataUrl, "data:image/png;base64,Zmlyc3Q=");
  assert.equal((await b).dataUrl, "data:image/jpeg;base64,c2Vjb25k");
  assert.equal((await missing).error, "ENOENT");
});
