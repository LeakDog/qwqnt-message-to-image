// preload：把保存图片 / 读取本地图片能力桥接到渲染进程 window。
const { contextBridge, ipcRenderer } = require("electron");

const NS = "qwqnt.message-to-image";

contextBridge.exposeInMainWorld("messageToImage", {
  apiVersion: 2,
  saveBase64ToFile: (fileName, base64) => ipcRenderer.send(`${NS}.saveBase64ToFile`, fileName, base64),
  log: (...args) => ipcRenderer.send(`${NS}.log`, ...args),
  // 读取本地图片文件 → { dataUrl } 或 { error }
  readLocalImage: (filePath) =>
    new Promise((resolve) => {
      // invoke 由 Electron 关联每次请求，支持头像和多张图片并发读取。
      const timer = setTimeout(() => resolve({ error: "读取超时: " + filePath }), 8000);
      ipcRenderer.invoke(`${NS}.readFile`, filePath).then(
        (result) => { clearTimeout(timer); resolve(result); },
        (err) => { clearTimeout(timer); resolve({ error: String(err?.message || err) }); }
      );
    }),
});
