// 主进程：接收渲染进程发来的 base64 图片并保存到磁盘。
// 配置读写全面迁移到 qwqnt-hako 的 PluginSettings（三端通用的 readConfig/writeConfig）。
const { ipcMain, dialog, BrowserWindow } = require("electron");
const { writeFileSync, existsSync } = require("fs");
const { readFile } = require("fs/promises");
const path = require("path");

const NS = "qwqnt.message-to-image";
const CH_SAVE = `${NS}.saveBase64ToFile`;
const CH_READ_FILE = `${NS}.readFile`;

// hako 用插件 id 区分各插件配置；与 package.json 的 name 保持一致
const CONFIG_ID = "qwqnt-message-to-image";

// 渲染倍率上限，与 renderer 保持一致，防止超大 canvas 导致进程 OOM
const MAX_SCALE = 8;

// 默认配置：hako 在配置文件不存在时会把它作为默认值写入
const defaultConfig = {
  scale: 2,
  savePath: "",
};

// 只保留已知字段并补齐缺失项，倍率做合法性校验与上限钳制
function normalizeConfig(raw) {
  const src = raw || {};
  const n = Number(src.scale);
  return {
    scale: Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_SCALE) : defaultConfig.scale,
    savePath: typeof src.savePath === "string" ? src.savePath : "",
  };
}

// 通过 hako 读取配置。hako 未就绪时回退到默认值。
function loadConfig() {
  try {
    if (typeof PluginSettings !== "undefined" && PluginSettings?.main?.readConfig) {
      return normalizeConfig(PluginSettings.main.readConfig(CONFIG_ID, defaultConfig));
    }
  } catch (err) {
    console.error("[消息转图片] 读取配置失败", err);
  }
  return { ...defaultConfig };
}

// ---------------------------------------------------------------------------
// 保存图片
// ---------------------------------------------------------------------------
ipcMain.on(`${NS}.log`, (_event, ...args) => {
  console.log("[消息转图片][渲染]", ...args);
});

// 读取本地图片文件，返回 dataURL（用于 QQ 图片本地缓存路径取图）
ipcMain.handle(CH_READ_FILE, async (_event, filePath) => {
  try {
    const resolved = path.resolve(String(filePath || ""));
    const ext = path.extname(resolved).toLowerCase().replace(".", "") || "png";
    const mime = `image/${ext === "jpg" ? "jpeg" : ext}`;
    const buf = await readFile(resolved);
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}` };
  } catch (err) {
    return { error: String(err?.message || err) };
  }
});

ipcMain.on(CH_SAVE, async (event, fileName, base64) => {
  try {
    const config = loadConfig();

    // 解析 base64 数据段：支持完整 data URL 或裸 base64 串
    const payload = String(base64 || "").trim();
    const idx = payload.indexOf(",");
    const data = idx >= 0 ? payload.slice(idx + 1) : payload;
    if (!/^[A-Za-z0-9+/=]+$/.test(data)) {
      throw new Error("base64 数据格式非法");
    }
    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0) throw new Error("base64 数据为空");

    // 已配置固定目录且存在 → 直接写入；写失败则回落到保存对话框
    if (config.savePath && existsSync(config.savePath)) {
      try {
        writeFileSync(path.join(config.savePath, fileName), buffer, { encoding: null });
        return;
      } catch (err) {
        console.error("[消息转图片] 固定目录写入失败，改用保存对话框:", err);
      }
    }

    // 否则弹出保存对话框（绑定到发起窗口，避免弹到错误窗口）
    const dialogOpts = {
      title: "选择图片保存位置",
      message: "选择图片保存位置",
      defaultPath: fileName,
      properties: ["dontAddToRecent"],
      filters: [{ name: "PNG 图片", extensions: ["png"] }],
    };
    const parent = BrowserWindow.fromWebContents(event.sender);
    const result = parent
      ? await dialog.showSaveDialog(parent, dialogOpts)
      : await dialog.showSaveDialog(dialogOpts);
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, buffer, { encoding: null });
    }
  } catch (err) {
    console.error("[消息转图片] 保存失败", err);
  }
});

console.log("[消息转图片] main 已加载 (配置由 qwqnt-hako 管理)");
