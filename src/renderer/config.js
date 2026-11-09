// 配置读写：由 qwqnt-hako 的 PluginSettings 管理（三端通用 readConfig/writeConfig）。
import { MAX_SCALE } from "./constants.js";
import { logMain } from "./extract.js";

export const CONFIG_ID = "qwqnt-message-to-image";
export const DEFAULT_CONFIG = { scale: 2, savePath: "" };

export function normalizeConfig(raw) {
  const src = raw || {};
  const n = Number(src.scale);
  return {
    scale: Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_SCALE) : DEFAULT_CONFIG.scale,
    savePath: typeof src.savePath === "string" ? src.savePath : "",
  };
}

export function readConfig() {
  try {
    if (typeof PluginSettings !== "undefined" && PluginSettings?.renderer?.readConfig) {
      return normalizeConfig(PluginSettings.renderer.readConfig(CONFIG_ID, DEFAULT_CONFIG));
    }
  } catch (err) {
    logMain("读取配置失败", err?.message || String(err));
  }
  return { ...DEFAULT_CONFIG };
}

export function writeConfig(cfg) {
  try {
    if (typeof PluginSettings !== "undefined" && PluginSettings?.renderer?.writeConfig) {
      return PluginSettings.renderer.writeConfig(CONFIG_ID, cfg);
    }
  } catch (err) {
    logMain("写入配置失败", err?.message || String(err));
  }
  return false;
}
