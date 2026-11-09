import test from "node:test";
import assert from "node:assert/strict";
import { registerElementRenderer } from "../src/renderer/ir.js";
import { createSticker, setStickerHooks } from "../src/renderer/sticker.js";

test("block image fits inside bubble and following text starts after its bottom", async () => {
  const rectangles = [];
  const texts = [];
  let block;
  const ctx = {
    save() {}, restore() {}, scale() {}, beginPath() {}, fill() {},
    measureText: text => ({ width: String(text).length * 7 }),
    roundRect: (...args) => rectangles.push(args),
    fillText: (...args) => texts.push(args),
  };
  const canvas = { getContext: () => ctx, toDataURL: () => "data:image/png;base64,dGVzdA==" };
  const original = globalThis.document;
  globalThis.document = { createElement: () => canvas };
  registerElementRenderer("test-block", {
    measure: () => ({ w: 100, h: 80 }),
    draw: (_node, x, y) => { block = { x, y, h: 80 }; },
  });
  let saved = false;
  setStickerHooks({ save: () => { saved = true; } });
  try {
    await createSticker({ scale: 2, items: [{ type: "msg", userName: "Sender", nodes: [
      { type: "test-block", inline: false, data: {} },
      { type: "text", inline: true, data: { text: "尾" } },
    ] }] });
    const [, top, , height] = rectangles[0];
    assert.equal(block.y, top + 6);
    assert.ok(block.y + block.h < top + height);
    assert.equal(texts.find(([text]) => text === "尾")[2], block.y + block.h + 14);
    assert.equal(saved, true);
  } finally { globalThis.document = original; }
});
