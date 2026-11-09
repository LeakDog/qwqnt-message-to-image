import { loadImageSrc, isExportableImage } from "./image-loader.js";

export async function loadAvatar(config) {
  const el = config.avatarImg;
  if (el?.complete && el.naturalWidth > 0 && isExportableImage(el)) return el;
  return loadImageSrc(config.avatarUrl);
}
