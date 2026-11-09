// 可扩展 IR（中间表示）框架。
// 提取层把 msgRecord.elements 解析为 IR 节点流，布局引擎只按
// 「内联(按字符折行) / 块级(独占一行)」处理，不感知具体消息类型。
// 新增消息类型（face/file/forward/语音…）只需 registerElementRenderer 注册一条。
import { IR_VERSION } from "./constants.js";

// 依赖注入：parseMessage 需要 logMain；由 index.js 装配时注入，避免循环依赖。
let logMain = () => {};

export function setIRLogger(fn) {
  logMain = fn || (() => {});
}

export function makeNode(type, inline, data) {
  return { v: IR_VERSION, type, inline, w: 0, h: 0, data };
}

// 元素渲染器注册表
const elementRenderers = new Map();
export function registerElementRenderer(type, renderer) {
  elementRenderers.set(type, renderer);
}
export function getRenderer(type) {
  return elementRenderers.get(type);
}

// 把消息记录解析为 IR 节点数组；未注册 / 解析失败 / 空内联段默认跳过。
// ctxInfo 携带渲染上下文（如消息 DOM 元素），供渲染器按需查询。
export function parseMessage(msgRecord, ctxInfo) {
  const nodes = [];
  for (const el of msgRecord?.elements || []) {
    let node = null;
    for (const renderer of elementRenderers.values()) {
      try {
        node = renderer.parse(el, { ...ctxInfo, msgRecord });
      } catch (err) {
        logMain("元素解析失败:", err?.message || String(err));
      }
      if (node) break;
    }
    if (node && !(node.inline && !node.data.text)) {
      nodes.push(node);
    }
  }
  if (nodes.length === 0 && (msgRecord?.elements || []).length > 0) {
    logMain("消息无可用元素（跳过）:", JSON.stringify(msgRecord?.elements).slice(0, 300));
  }
  return nodes;
}

// AT 显示文本：昵称可能缺 @ 前缀或为空，统一规范化；@全体成员特殊回填
export function atDisplayText(at) {
  const raw = at?.content || at?.nickname || at?.text || "";
  const name = String(raw).replace(/^@+/, "");
  const isAll = Number(at?.atType) === 1 || at?.atType === "All" || at?.atType === "all" || at?.atAll;
  if (name) return "@" + name;
  if (isAll) return "@全体成员";
  return at?.atUid ? "@" + at.atUid : "";
}

// 布局引擎：内联节点按字符折行，块级节点独占一行。
// 返回 lines：[{kind:"inline", segments:[{type,text}], width} | {kind:"block", node, width, height}]
export function layoutNodes(ctx, nodes, maxWidth, font) {
  ctx.font = font;
  const lines = [];
  let cur = [];
  let curW = 0;
  let trailingNewline = false;

  const pushLine = () => {
    lines.push({ kind: "inline", segments: cur, width: curW });
    cur = [];
    curW = 0;
  };

  for (const node of nodes) {
    if (!node.inline) {
      if (cur.length) pushLine();
      lines.push({ kind: "block", node, width: node.w, height: node.h });
      trailingNewline = false;
      continue;
    }
    const text = String(node.data.text || "").replace(/\r/g, "");
    for (const ch of text) {
      if (ch === "\n") {
        pushLine();
        trailingNewline = true;
        continue;
      }
      trailingNewline = false;
      const cw = ctx.measureText(ch).width;
      if (cur.length && curW + cw > maxWidth) pushLine();
      cur.push({ type: node.type, text: ch });
      curW += cw;
    }
  }
  if (cur.length || trailingNewline) pushLine();
  return lines;
}
