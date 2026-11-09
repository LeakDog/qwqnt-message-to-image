// 内置渲染器：text / at
import { makeNode, registerElementRenderer, atDisplayText } from "../ir.js";

// 按最大宽度截断文本，超长尾部加省略号
export function truncateText(ctx, text, maxWidth) {
  let out = String(text || "");
  if (ctx.measureText(out).width <= maxWidth) return out;
  while (out.length > 1 && ctx.measureText(out + "…").width > maxWidth) {
    out = out.slice(0, -1);
  }
  return out + "…";
}

registerElementRenderer("text", {
  parse(el) {
    if (!el?.textElement) return null;
    const text = el.textElement;
    if (text.atType && text.atType !== "0") {
      return makeNode("at", true, { text: atDisplayText(text) });
    }
    return makeNode("text", true, { text: text.content });
  },
  measure(ctx, node) {
    const w = ctx.measureText(node.data.text || "").width;
    return { w, h: 20 };
  },
});

registerElementRenderer("at", {
  parse(el) {
    if (!el?.atElement) return null;
    const text = atDisplayText(el.atElement);
    if (!text) return null;
    return makeNode("at", true, { text });
  },
  measure(ctx, node) {
    const w = ctx.measureText(node.data.text || "").width;
    return { w, h: 20 };
  },
});
