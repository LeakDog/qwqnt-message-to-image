// 渲染进程入口：装配各模块，注入右键菜单「转图片」、多选工具栏、设置界面。
// 产物为 IIFE 单文件（vite），与 QQ 渲染进程上下文直接兼容。
import "./renderers/text-at.js";
import "./renderers/reply.js";
import "./renderers/time.js";
import "./renderers/image.js";
import { parseMessage } from "./ir.js";
import { setIRLogger } from "./ir.js";
import { setImageLogger } from "./renderers/image.js";
import { createSticker, setStickerHooks } from "./sticker.js";
import { getParentElement, getUserName, getAvatarImg, isDarkTheme, logMain, findMessageRecord } from "./extract.js";
import { readConfig } from "./config.js";
import { setupMultiSelect, setMultiSelectHooks } from "./multi-select.js";
import { buildSettingsUI, bindSettingsState } from "./settings-ui.js";

// 传给 hako registerPluginSettings 的最小清单
const pluginPackageJson = {
  name: "qwqnt-message-to-image",
  qwqnt: { name: "消息转图片" },
};

const imageIcon = `<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M885.76 204.8v614.4H138.24V204.8h747.52m10.24-71.68H128c-33.93024 0-61.44 27.50976-61.44 61.44v634.88c0 33.93024 27.50976 61.44 61.44 61.44h768c33.93024 0 61.44-27.50976 61.44-61.44V194.56c0-33.93024-27.50976-61.44-61.44-61.44z" fill="currentColor"></path><path d="M256.03584 718.40768a35.81952 35.81952 0 0 1-30.89408-17.6128c-9.91744-16.7424-3.83488-38.46656 12.49792-49.03936l190.45376-123.26912a40.96 40.96 0 0 1 44.08832-0.27136l101.376 63.86176a20.48 20.48 0 0 0 22.36416-0.34816l182.76864-123.20768a35.84512 35.84512 0 0 1 50.36544 10.61888c10.46528 16.59392 4.72576 38.68672-11.54048 49.65376l-209.19296 141.02016a40.94976 40.94976 0 0 1-44.72832 0.6912l-101.95456-64.22528a20.46976 20.46976 0 0 0-22.0416 0.13824l-164.11648 106.22464a35.67104 35.67104 0 0 1-19.44576 5.76512z" fill="currentColor"></path><path d="M337.92 373.76m-51.2 0a51.2 51.2 0 1 0 102.4 0 51.2 51.2 0 1 0-102.4 0Z" fill="currentColor"></path></svg>`;

// ---------------------------------------------------------------------------
// 配置状态
// ---------------------------------------------------------------------------
let pluginConfig = { scale: 2, savePath: "" };
function refreshConfig() {
  pluginConfig = readConfig();
  return pluginConfig;
}
refreshConfig();
bindSettingsState({
  config: pluginConfig,
  setConfig: (cfg) => {
    pluginConfig = cfg;
  },
});

// ---------------------------------------------------------------------------
// 依赖注入
// ---------------------------------------------------------------------------
setIRLogger(logMain);
setImageLogger(logMain);
setStickerHooks({
  log: logMain,
  save: (fileName, base64) => {
    if (window.messageToImage && window.messageToImage.saveBase64ToFile) {
      return window.messageToImage.saveBase64ToFile(fileName, base64);
    } else {
      throw new Error("preload 未注入 window.messageToImage");
    }
  },
});
setMultiSelectHooks({ getScale: () => refreshConfig().scale });

// ---------------------------------------------------------------------------
// 右键菜单注入
// ---------------------------------------------------------------------------
let msgSticker = null;

document.addEventListener("mouseup", (event) => {
  if (event.button !== 2) {
    msgSticker = null;
    return;
  }
  refreshConfig();
  msgSticker = null;
  const messageEl = getParentElement(event.target, "message");
  if (!messageEl) {
    logMain("[诊断] 右键目标不在消息行内: class=", event.target.className);
    return;
  }

  const found = findMessageRecord(messageEl);
  if (!found) {
    logMain("未找到消息记录（msgRecord），尝试 DOM 文本兜底");
    const domText = messageEl.querySelector(".message-content")?.innerText?.trim();
    if (!domText) return;
    // DOM 兜底：仅按纯文本渲染（无 @ 染色/无图片/无回复），保证按钮可用
    msgSticker = {
      userName: getUserName(messageEl, null),
      nodes: [{ v: 1, type: "text", inline: true, w: 0, h: 0, data: { text: domText } }],
      avatarImg: getAvatarImg(messageEl).img,
      avatarUrl: getAvatarImg(messageEl).url,
      fontFamily: getComputedStyle(messageEl).getPropertyValue("font-family"),
      fromDomFallback: true,
    };
    return;
  }
  const msgRecord = found.msgRecord;
  const nodes = parseMessage(msgRecord, { messageEl });
  if (!nodes.length) return;

  const userName = getUserName(messageEl, msgRecord);
  const avatar = getAvatarImg(messageEl);
  const fontFamily = getComputedStyle(messageEl).getPropertyValue("font-family");
  msgSticker = { userName, nodes, avatarImg: avatar.img, avatarUrl: avatar.url, fontFamily };
});

function appendMenuItem(qContextMenu, icon, title, onClick, keepOpen) {
  const template =
    qContextMenu.querySelector(`.q-context-menu-item:not([disabled="true"])`) ||
    document.querySelector(`.q-context-menu-item:not([disabled="true"])`);
  if (!template) return null;

  const item = template.cloneNode(true);
  item.removeAttribute("id");
  item.style.removeProperty("color");
  const iconEl = item.querySelector(".q-icon");
  if (iconEl && icon) iconEl.innerHTML = icon;
  const textEl = item.querySelector(".q-context-menu-item__text");
  if (textEl) {
    textEl.innerText = title;
  } else {
    item.innerText = title;
  }

  item.addEventListener("click", () => {
    onClick();
    if (!keepOpen) qContextMenu.remove();
  });
  qContextMenu.appendChild(item);
  return item;
}

new MutationObserver(() => {
  const qContextMenu = document.querySelector(".q-context-menu:not(.message-to-image-injected)");
  if (!qContextMenu) return;
  qContextMenu.classList.add("message-to-image-injected");

  if (msgSticker) {
    const scale = pluginConfig.scale > 0 ? pluginConfig.scale : 2;
    const data = { ...msgSticker, isDark: isDarkTheme(), scale };
    data.items = [{ type: "msg", ...msgSticker }];
    appendMenuItem(qContextMenu, imageIcon, "转图片", () => createSticker(data).catch(err => logMain("导出失败:", err?.message || String(err))));
  }
}).observe(document.body, { childList: true, subtree: true });

// ---------------------------------------------------------------------------
// 多选模式
// ---------------------------------------------------------------------------
setupMultiSelect();

// ---------------------------------------------------------------------------
// 设置界面
// ---------------------------------------------------------------------------
try {
  if (typeof RendererEvents !== "undefined" && RendererEvents?.onSettingsWindowCreated) {
    RendererEvents.onSettingsWindowCreated(async () => {
      try {
        const view = await PluginSettings.renderer.registerPluginSettings(pluginPackageJson);
        if (view) buildSettingsUI(view);
      } catch (err) {
        logMain("注册设置页失败", err?.message || String(err));
      }
    });
  } else {
    logMain("未检测到 qwqnt-hako (RendererEvents)，设置界面不可用");
  }
} catch (err) {
  logMain("设置界面初始化异常", err?.message || String(err));
}

console.log("[消息转图片] renderer 已加载");

// 诊断辅助：暴露到 window，便于在 QQ 控制台排查 DOM 结构
window.__M2I_DIAG__ = {
  // 找到当前可见的消息行元素，输出其 Vue 挂载形态与 props 键
  dumpMessageRow() {
    const rows = Array.from(document.querySelectorAll("[class*='message']")).filter((el) => {
      const v = el.__vue__ || el.__VUE__;
      if (!v) return false;
      const nodes = Array.isArray(v) ? v : [v];
      return nodes.some((n) => n && (n.props || n.$props) && Object.keys(n.props || n.$props).length > 0);
    });
    if (!rows.length) return "未找到带 Vue props 的消息行";
    const el = rows[0];
    const raw = el.__vue__ || el.__VUE__;
    const nodes = Array.isArray(raw) ? raw : [raw];
    const summary = nodes.map((n) => {
      const p = (n && (n.props || n.$props)) || {};
      return {
        vueKind: Array.isArray(raw) ? `array[${raw.length}]` : "object",
        propsKeys: Object.keys(p),
        hasMsgRecord: !!p.msgRecord,
        hasElements: Array.isArray(p.msgRecord?.elements),
        elementsCount: Array.isArray(p.msgRecord?.elements) ? p.msgRecord.elements.length : null,
        msgRecordKeys: p.msgRecord ? Object.keys(p.msgRecord).slice(0, 30) : [],
      };
    });
    return {
      class: el.className,
      nodes: summary,
      elementsSample: JSON.stringify(nodes[0]?.props?.msgRecord?.elements || {}).slice(0, 800),
    };
  },
  // 列出进入多选后新增/变化的 DOM 元素 class（粗略）
  listSelectToolbars() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll("*").forEach((el) => {
      if (!el.className || typeof el.className !== "string") return;
      if (/select|Select|check|Check|toolbar|action|bar|multi|Multi/.test(el.className)) {
        const c = el.className;
        if (!seen.has(c)) {
          seen.add(c);
          out.push(c.slice(0, 120));
        }
      }
    });
    return out.slice(0, 60);
  },
};
