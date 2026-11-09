// 使用 QQ 原生多选状态，按消息列表顺序导出当前已渲染的选中消息。
import { parseMessage } from "./ir.js";
import { getUserName, getAvatarImg, logMain, findMessageRecord, isDarkTheme } from "./extract.js";
import { createSticker } from "./sticker.js";

const TOOLBAR_SELECTOR = ".forward-ops, .msg-select-bar, .q-msg-select-bar, .message-select-bar";
let readScale = () => 2;
export function setMultiSelectHooks({ getScale }) { readScale = getScale || (() => 2); }

export function collectSelectedMessageEls() {
  return [...document.querySelectorAll(".message")].filter(row => {
    const props = findMessageRecord(row)?.props;
    if (typeof props?.pickerData?.selected === "boolean") {
      return !!props.showPicker && props.pickerData.selected;
    }
    return !!row.querySelector('.msg-picker.is-checked, input[type="checkbox"]:checked, [role="checkbox"][aria-checked="true"]') ||
      row.classList.contains("selected");
  });
}

export function buildMultiItems() {
  const items = [];
  for (const messageEl of collectSelectedMessageEls()) {
    const found = findMessageRecord(messageEl);
    if (!found) continue;
    const { msgRecord } = found;
    if (msgRecord.elements?.some(el => el.grayTipElement) ||
        /system|notice|notification/i.test(String(msgRecord.msgType))) continue;
    const nodes = parseMessage(msgRecord, { messageEl });
    if (!nodes.length) continue;
    // 时间是消息行旁的 DOM，而不是 msgRecord.elements 中的 timeElement。
    const timeText = messageEl.querySelector(".message__timestamp")?.textContent?.trim();
    if (timeText) items.push({ type: "time", text: timeText });
    const avatar = getAvatarImg(messageEl);
    items.push({
      type: "msg", userName: getUserName(messageEl, msgRecord), nodes,
      avatarImg: avatar.img, avatarUrl: avatar.url,
      fontFamily: getComputedStyle(messageEl).fontFamily || "sans-serif",
    });
  }
  return items;
}

export function exitMultiSelect(toolbar) {
  toolbar?.querySelector(".op-close-icon, .q-msg-select-bar__close, .msg-select-close, .select-bar__close")?.click();
}

function injectToolbarButton(toolbar) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "转图片";
  btn.className = "m2i-toolbar-btn";
  btn.title = "导出当前已加载的选中消息";
  btn.style.cssText = "padding:8px 12px;margin:0 8px;border-radius:8px;border:none;cursor:pointer;font-size:13px;color:#fff;background:#1B6EFF;";
  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "生成中…";
    try {
      const items = buildMultiItems();
      if (!items.length) throw new Error("没有可转图片的选中消息");
      await createSticker({ items, isDark: isDarkTheme(), scale: readScale(), fontFamily: items.find(it => it.fontFamily)?.fontFamily || "sans-serif" });
      exitMultiSelect(toolbar);
    } catch (err) {
      logMain("多选导出失败:", err?.message || String(err));
      btn.title = err?.message || String(err);
    } finally {
      btn.disabled = false;
      btn.textContent = "转图片";
    }
  });
  const list = toolbar.matches("ul") ? toolbar : toolbar.querySelector("ul");
  if (list) {
    const li = document.createElement("li");
    li.appendChild(btn);
    list.insertBefore(li, list.lastElementChild);
  } else {
    toolbar.appendChild(btn);
  }
}

export function setupMultiSelect() {
  function inject() {
    for (const toolbar of document.querySelectorAll(TOOLBAR_SELECTOR)) {
      if (toolbar.querySelector(".m2i-toolbar-btn") || !toolbar.getClientRects().length) continue;
      injectToolbarButton(toolbar);
    }
  }
  const observer = new MutationObserver(inject);
  observer.observe(document.body, { childList: true, subtree: true });
  inject();
  return () => observer.disconnect();
}
