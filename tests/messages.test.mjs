import test from "node:test";
import assert from "node:assert/strict";
import "../src/renderer/renderers/text-at.js";
import "../src/renderer/renderers/reply.js";
import "../src/renderer/renderers/image.js";
import { parseMessage, layoutNodes, getRenderer } from "../src/renderer/ir.js";
import { formatTime } from "../src/renderer/renderers/time.js";
import { toLocalFilePath } from "../src/renderer/image-loader.js";

test("QQ textElement distinguishes plain text, member mention and everyone", () => {
  const nodes = parseMessage({ elements: [
    { textElement: { content: "正文", atType: 0 } },
    { textElement: { content: "@成员", atType: 2 } },
    { textElement: { content: "", atType: 1 } },
  ] });
  assert.deepEqual(nodes.map(n => [n.type, n.data.text]), [["text", "正文"], ["at", "@成员"], ["at", "@全体成员"]]);
});

test("reply uses structured summary and DOM sender, not deleted placeholder", () => {
  const [node] = parseMessage({ elements: [{ replyElement: {
    senderUid: "123", sourceMsgText: "", sourceMsgTextElems: [{ textElemContent: "原文" }, { picElem: {} }],
  } }] }, { messageEl: { querySelector: () => ({ textContent: "发送者" }) } });
  assert.equal(node.data.sender, "发送者");
  assert.equal(node.data.summary, "原文[图片]");
});

test("picElement retains distinct source/thumbnail candidates and bounds tall images", () => {
  const [node] = parseMessage({ elements: [{ picElement: {
    sourcePath: "C:/original.png", thumbPath: new Map([[0, "C:/thumb.png"]]),
    picWidth: 800, picHeight: 1600, fileUuid: "not-a-path",
  } }] });
  assert.deepEqual(node.data.urls, ["C:/original.png", "C:/thumb.png"]);
  assert.deepEqual(getRenderer("image").measure(null, node), { w: 240, h: 480 });
});

test("multiple pictures without data-element-id use their corresponding DOM image", () => {
  const images = [
    { src: "data:image/png;base64,first", getBoundingClientRect: () => ({ width: 112, height: 150 }) },
    { src: "data:image/png;base64,second", getBoundingClientRect: () => ({ width: 200, height: 100 }) },
  ];
  const messageEl = { querySelectorAll: selector => selector === "[data-element-id]" ? [] : images };
  const nodes = parseMessage({ elements: [{ picElement: {} }, { picElement: {} }] }, { messageEl });
  assert.deepEqual(nodes.map(n => n.data.urls), [[images[0].src], [images[1].src]]);
  assert.deepEqual(nodes.map(n => [n.data.dw, n.data.dh]), [[112, 150], [200, 100]]);
});

test("layout preserves trailing blank line and block ordering", () => {
  const nodes = parseMessage({ elements: [{ textElement: { content: "a\n\n" } }] });
  const ctx = { measureText: text => ({ width: text.length * 10 }) };
  assert.equal(layoutNodes(ctx, nodes, 100, "14px sans-serif").length, 3);
  nodes.push({ inline: false, type: "image", w: 80, h: 60 });
  const lines = layoutNodes(ctx, nodes, 100, "14px sans-serif");
  assert.equal(lines.at(-1).kind, "block");
});

test("QQ seconds and numeric strings produce same local time as milliseconds", () => {
  const ms = new Date(2026, 6, 22, 12, 34).getTime();
  assert.equal(formatTime(String(ms / 1000)), formatTime(ms));
  assert.match(formatTime(ms), /12:34$/);
});

test("local URL normalization handles drive, escaped names and UNC", () => {
  assert.equal(toLocalFilePath("file:///E:/Tencent%20Files/a.png"), "E:/Tencent Files/a.png");
  assert.equal(toLocalFilePath("appimg://E:/Tencent%20Files/a.png?x=1"), "E:/Tencent Files/a.png");
  assert.equal(toLocalFilePath("file://server/share/a.png"), "//server/share/a.png");
  assert.equal(toLocalFilePath("https://example.com/a.png"), null);
});
