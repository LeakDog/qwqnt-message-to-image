// time 渲染器：块级、居中、灰字，按 QQ 本地时间格式
import { makeNode, registerElementRenderer } from "../ir.js";

// 按 QQ 本地时间格式：同日只显示 HH:mm；同年显示 M月D日 HH:mm；跨年显示 YYYY年M月D日 HH:mm
export function formatTime(time) {
  if (!time) return "";
  const numeric = Number(time);
  const d = new Date(Number.isFinite(numeric) ? (numeric < 1e12 ? numeric * 1000 : numeric) : time);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const sameYear = d.getFullYear() === now.getFullYear();
  const hh = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (sameDay) return hh;
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (sameYear) return `${md} ${hh}`;
  return `${d.getFullYear()}年${md} ${hh}`;
}

registerElementRenderer("time", {
  parse(el) {
    if (!el?.timeElement) return null;
    const text = formatTime(el.timeElement.time);
    if (!text) return null;
    return makeNode("time", false, { text });
  },
  measure(ctx, node) {
    const text = node.data.text || "";
    ctx.font = "12px " + (ctx.font.split("px ").slice(1).join("px ") || "sans-serif");
    const w = ctx.measureText(text).width + 24;
    return { w, h: 24 };
  },
  draw(node, x, y, drawCtx) {
    const { ctx, fontFamily, colors } = drawCtx;
    const text = node.data.text || "";
    ctx.save();
    ctx.font = "12px " + fontFamily;
    ctx.fillStyle = colors.timeColor;
    ctx.textAlign = "center";
    ctx.fillText(text, x + node.w / 2, y + 17);
    ctx.restore();
  },
});
