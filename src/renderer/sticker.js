// createSticker：canvas 绘制消息图片。
// config.items: [{ type:"msg", userName, nodes, avatarImg, avatarUrl, fontFamily }
//               | { type:"time", text }]
// 单条消息调用时 items = [ {type:"msg", ...msgSticker} ]
import { layoutNodes, getRenderer } from "./ir.js";
import { loadAvatar } from "./avatar.js";
import { preloadImageNodes } from "./renderers/image.js";
import { COLORS, MSG_BOX_MAX_WIDTH, MAX_SCALE } from "./constants.js";

let logMain = () => {};
let saveBase64 = (fileName, base64) => {
  console.error("[消息转图片] preload 未注入 window.messageToImage");
};
export function setStickerHooks({ log, save }) {
  if (log) logMain = log;
  if (save) saveBase64 = save;
}

export async function createSticker(config) {
  const zoom = Number.isFinite(Number(config.scale)) && config.scale >= 1 ? Math.min(Number(config.scale), MAX_SCALE) : 2;
  const msgBoxMaxWidth = MSG_BOX_MAX_WIDTH;
  const lineHeight = 20;
  const fontFamily = config.fontFamily || "sans-serif";
  const baseFont = "14px " + fontFamily;

  const items = (config.items || []).map((it) => ({
    ...it,
    lines: null,
    width: 0,
    height: 0,
    bubbleW: 0,
    bubbleH: 0,
    avatarLoaded: false,
    avatarImg: it.avatarImg || null,
  }));
  if (!items.length) throw new Error("没有可导出的消息");

  const canvasEl = document.createElement("canvas");
  const ctx = canvasEl.getContext("2d");

  const isDark = !!config.isDark;
  const userNameColor = COLORS.userName[isDark ? "dark" : "light"];
  const msgBoxColor = COLORS.msgBox[isDark ? "dark" : "light"];
  const contextColor = COLORS.context[isDark ? "dark" : "light"];
  const atColor = COLORS.at[isDark ? "dark" : "light"];
  const timeColor = COLORS.time[isDark ? "dark" : "light"];

  // 预加载所有消息的头像与图片节点
  const avatarTasks = [];
  for (const it of items) {
    if (it.type !== "msg") continue;
    avatarTasks.push(preloadImageNodes(it.nodes));
    avatarTasks.push(loadAvatar(it).then((img) => (it.avatarImg = img)));
  }
  await Promise.all(avatarTasks);

  // 逐条测量尺寸
  let maxWidth = 0;
  let totalHeight = 0;
  for (const it of items) {
    if (it.type === "time") {
      ctx.save();
      ctx.font = "12px " + fontFamily;
      const w = ctx.measureText(it.text).width + 24;
      ctx.restore();
      it.width = w;
      it.height = 24;
      maxWidth = Math.max(maxWidth, w);
      totalHeight += it.height;
      continue;
    }
    ctx.save();
    ctx.font = baseFont;
    for (const node of it.nodes || []) {
      const renderer = getRenderer(node.type);
      if (!renderer?.measure) continue;
      ctx.save();
      const m = renderer.measure(ctx, node);
      ctx.restore();
      node.w = m.w;
      node.h = m.h;
    }
    const lines = layoutNodes(ctx, it.nodes || [], msgBoxMaxWidth, baseFont);
    let width = 0;
    let height = 0;
    let inlineHeight = 0;
    for (const line of lines) {
      width = Math.max(width, line.width);
      if (line.kind === "block") height += line.height;
      else inlineHeight += lineHeight;
    }
    height += inlineHeight;
    it.lines = lines;
    it.width = width;
    it.height = height;

    // 气泡区宽度 = 内容宽 + 内边距；总宽还需容纳头像列
    it.bubbleW = width + 20;
    it.bubbleH = height + 12;

    // 测量用户名长度
    ctx.font = "12px " + (it.fontFamily || fontFamily);
    const userNameWidth = ctx.measureText(it.userName).width + 42 + 4;
    const rowW = Math.max(userNameWidth, 4 + 32 + 10 + it.bubbleW);
    it.rowW = rowW;
    maxWidth = Math.max(maxWidth, rowW);
    totalHeight += 20 + it.bubbleH + 16;
    ctx.restore();
  }

  // 时间分隔符上下各留一点空隙
  totalHeight += items.filter((it) => it.type === "time").length * 8;

  const pixelWidth = Math.ceil(maxWidth * zoom);
  const pixelHeight = Math.ceil(totalHeight * zoom);
  if (pixelWidth > 32767 || pixelHeight > 32767 || pixelWidth * pixelHeight > 64 * 1024 * 1024) {
    throw new Error("图片过大，请减少选中消息或降低渲染倍率");
  }
  canvasEl.width = pixelWidth;
  canvasEl.height = pixelHeight;

  // 整体按 zoom 放大：之后一律用逻辑坐标绘制
  ctx.save();
  ctx.scale(zoom, zoom);

  const drawCtx = {
    ctx,
    zoom,
    font: baseFont,
    fontFamily,
    lineHeight,
    colors: { contextColor, atColor, msgBoxColor, timeColor },
  };

  let y = 0;
  for (const it of items) {
    if (it.type === "time") {
      ctx.save();
      ctx.font = "12px " + fontFamily;
      ctx.fillStyle = timeColor;
      ctx.textAlign = "center";
      ctx.fillText(it.text, maxWidth / 2, y + 17);
      ctx.restore();
      y += it.height + 8;
      continue;
    }

    // 消息行：头像 + 昵称 + 气泡
    if (it.avatarImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(20, y + 20, 16, 0, Math.PI * 2, false);
      ctx.clip();
      ctx.drawImage(it.avatarImg, 4, y + 4, 32, 32);
      ctx.restore();
    }

    ctx.save();
    ctx.font = "12px " + (it.fontFamily || fontFamily);
    ctx.fillStyle = userNameColor;
    ctx.fillText(it.userName, 42, y + 14);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(42, y + 20, it.bubbleW, it.bubbleH, 8);
    ctx.fillStyle = msgBoxColor;
    ctx.fill();
    ctx.restore();

    // 内容
    ctx.save();
    ctx.font = baseFont;
    // 块节点使用顶边坐标，文字使用基线；两者不能共享基线起点。
    let ty = y + 26;
    for (const line of it.lines) {
      if (line.kind === "block") {
        const renderer = getRenderer(line.node.type);
        if (renderer?.draw) renderer.draw(line.node, 52, ty, drawCtx);
        ty += line.height;
      } else {
        ctx.fillStyle = contextColor;
        let x = 52;
        for (const seg of line.segments) {
          if (seg.type === "at") ctx.fillStyle = atColor;
          ctx.fillText(seg.text, x, ty + 14);
          if (seg.type === "at") ctx.fillStyle = contextColor;
          x += ctx.measureText(seg.text).width;
        }
        ty += lineHeight;
      }
    }
    ctx.restore();

    y += 20 + it.bubbleH + 16;
  }
  ctx.restore();

  let base64;
  try {
    base64 = canvasEl.toDataURL("image/png", 1);
  } catch (err) {
    // 画布被跨域头像污染，无法导出 → 跳过头像重绘一次
    if (!config._noAvatarRetry) {
      logMain("画布被头像污染，跳过头像重试:", err?.message || String(err));
      return createSticker({
        ...config,
        items: items.map((it) => ({ ...it, avatarImg: null, avatarUrl: "" })),
        _noAvatarRetry: true,
      });
    }
    throw err;
  }
  const suffix = Math.random().toString(36).slice(2, 8);
  if (base64 === "data:,") throw new Error("画布导出失败，请降低渲染倍率");
  await saveBase64(`${Date.now()}-${suffix}.png`, base64);
  return { width: canvasEl.width, height: canvasEl.height };
}
