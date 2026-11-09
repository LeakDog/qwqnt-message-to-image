import { makeNode, registerElementRenderer } from "../ir.js";
import { loadImageSrc } from "../image-loader.js";
import { MSG_BOX_MAX_WIDTH } from "../constants.js";

let logMain = () => {};
export function setImageLogger(fn) { logMain = fn || (() => {}); }

function pathValues(value) {
  if (typeof value === "string") return [value];
  if (value instanceof Map) return [...value.values()].flatMap(pathValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(pathValues);
  return [];
}

registerElementRenderer("image", {
  parse(el, ctxInfo) {
    const pic = el?.picElement || el?.imageElement;
    if (!pic) return null;
    const row = ctxInfo?.messageEl;
    const host = row && [...row.querySelectorAll("[data-element-id]")]
      .find(node => node.getAttribute("data-element-id") === String(el.elementId));
    const picIndex = ctxInfo?.msgRecord?.elements?.filter(e => e.picElement || e.imageElement).indexOf(el) ?? 0;
    const image = (host?.matches("img") ? host : host?.querySelector("img")) ||
      row?.querySelectorAll('.pic-element img, img[data-role="pic"]')[Math.max(0, picIndex)];
    // 优先原图，再尝试缩略图及此元素的 DOM 源。fileUuid 是标识而非 URL。
    const urls = [...new Set([
      pic.sourcePath, image?.currentSrc, image?.src,
      /^https?:\/\//i.test(pic.originImageUrl || "") ? pic.originImageUrl : "",
      pic.url, pic.picUrl, pic.imageUrl,
      ...pathValues(pic.thumbPath), pic.thumbImageUrl, pic.thumbnailUrl,
      pic.path, pic.filePath, pic.localPath, pic.localUrl,
    ].filter(value => typeof value === "string" && value))];
    const rect = image?.getBoundingClientRect();
    let dw = rect?.width || Number(pic.picWidth || pic.width) || 240;
    let dh = rect?.height || Number(pic.picHeight || pic.height) || 160;
    const scale = Math.min(1, MSG_BOX_MAX_WIDTH / dw, 480 / dh);
    dw = Math.max(1, Math.round(dw * scale));
    dh = Math.max(1, Math.round(dh * scale));
    return makeNode("image", false, { urls, dw, dh, image: null, loaded: false, failed: false });
  },
  measure(_ctx, node) { return { w: node.data.dw, h: node.data.dh }; },
  draw(node, x, y, { ctx, colors, fontFamily }) {
    const { dw, dh, image } = node.data;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, dw, dh, 4);
    ctx.clip();
    if (image) {
      const ratio = Math.min(dw / image.naturalWidth, dh / image.naturalHeight);
      const w = image.naturalWidth * ratio;
      const h = image.naturalHeight * ratio;
      ctx.drawImage(image, x + (dw - w) / 2, y + (dh - h) / 2, w, h);
    } else {
      ctx.fillStyle = colors.contextColor;
      ctx.font = "12px " + fontFamily;
      ctx.textAlign = "center";
      ctx.fillText("图片加载失败", x + dw / 2, y + dh / 2);
    }
    ctx.restore();
  },
});

export async function preloadImageNodes(nodes) {
  await Promise.all((nodes || []).filter(node => node.type === "image").map(async (node) => {
    if (node.data.loaded || node.data.failed) return;
    for (const url of node.data.urls) {
      const image = await loadImageSrc(url);
      if (image) {
        node.data.image = image;
        node.data.loaded = true;
        return;
      }
    }
    node.data.failed = true;
    logMain("图片加载失败，已使用占位文字");
  }));
}
