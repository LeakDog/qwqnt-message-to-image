// 所有图片先转为可安全导出的 Image；失败返回 null，不把污染的源图交给画布。
const TIMEOUT = 8000;

export function imageFromSrc(src, crossOrigin = false) {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (value) => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      resolve(value);
    };
    const timer = setTimeout(() => { finish(null); image.src = ""; }, TIMEOUT);
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = src;
  });
}

export function toLocalFilePath(url) {
  if (!url) return null;
  let p = String(url);
  const protocol = p.match(/^(appimg|appvideo|appshare|file):\/\//i);
  if (protocol) {
    p = p.slice(protocol[0].length).split(/[?#]/)[0];
    if (protocol[1].toLowerCase() === "file" && !p.startsWith("/") && !/^[a-z]:/i.test(p)) {
      p = "//" + p;
    }
  } else if (!/^[a-z]:[\\/]/i.test(p) && !p.startsWith("\\\\") && !p.startsWith("/")) {
    return null;
  }
  try { p = decodeURIComponent(p); } catch { /* 保留原路径 */ }
  p = p.replace(/^\/(?=[a-z]:[\\/])/i, "");
  return p;
}

export function isExportableImage(image) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch { return false; }
}

export async function loadImageSrc(url) {
  if (!url) return null;
  const filePath = toLocalFilePath(url);
  // 旧 preload 的广播回包不支持并发；renderer 单独更新时改走协议加载。
  if (filePath && window.messageToImage?.apiVersion >= 2 && window.messageToImage?.readLocalImage) {
    try {
      const result = await window.messageToImage.readLocalImage(filePath);
      if (result?.dataUrl) {
        const image = await imageFromSrc(result.dataUrl);
        if (image) return image;
      }
    } catch { /* 继续协议加载 */ }
  }

  if (filePath && /^[a-z]:[\\/]/i.test(url)) {
    url = "appimg://" + encodeURI(filePath.replace(/\\/g, "/")).replace(/#/g, "%23").replace(/\?/g, "%3F");
  }

  if (/^(https?:|appimg:|app:|file:)/i.test(url)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    let objectUrl;
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        objectUrl = URL.createObjectURL(await response.blob());
        const image = await imageFromSrc(objectUrl);
        if (image) return image;
      }
    } catch { /* 继续 Image 加载 */ }
    finally {
      clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  const image = await imageFromSrc(url, /^https?:/i.test(url));
  return image && isExportableImage(image) ? image : null;
}
