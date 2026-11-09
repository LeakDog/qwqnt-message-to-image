// DOM 提取层：昵称/头像/系统消息识别/主题检测等，供单条右键与多选共用。

export function logMain(...args) {
  console.log("[消息转图片]", ...args);
  try {
    window.messageToImage?.log?.(...args);
  } catch {
    /* ignore */
  }
}

export function getParentElement(element, className) {
  // 优先消息行本身，避免把 message-content / message-container 误当作消息行。
  const exact = element?.closest?.(`.${className}`);
  if (exact) return exact;
  let el = element;
  while (el && el !== document.body) {
    if (el.classList) {
      if (el.classList.contains(className)) {
        return el;
      }
      // 兜底：class 以 message 开头（message-item / message__bubble 等）
      for (const cls of el.classList) {
        if (cls === className || cls.indexOf(className + "-") === 0 || cls.indexOf(className + "__") === 0) {
          return el;
        }
      }
    }
    el = el.parentElement;
  }
  return null;
}

// 从元素或其祖先的 Vue 实例上取出消息记录。
// QQ 各版本 Vue 挂载形态不一：__VUE__ 可能是数组（lite_tools 用 __VUE__[0].props.msgRecord），
// 也可能是对象（__vue__.props）；props 字段名也有 msgRecord / message / item 等多种。
export function findMessageRecord(element, maxDepth = 12) {
  let el = element;
  for (let d = 0; el && d < maxDepth; d++) {
    const raw = el.__vue__ || el.__VUE__;
    if (raw) {
      // 归一化：__VUE__ 数组 → 逐个试；对象 → 直接用
      const nodes = Array.isArray(raw) ? raw : [raw];
      for (const vnode of nodes) {
        if (!vnode) continue;
        const props = vnode.props || vnode.$props || {};
        const candidates = [
          props.msgRecord,
          props.msg,
          props.message,
          props.messageRecord,
          props.item,
          props.messageData,
          props.record,
        ];
        for (const c of candidates) {
          if (c && Array.isArray(c.elements) && c.elements.length > 0) {
            return { msgRecord: c, el, props };
          }
        }
        // 父组件 props 兜底
        const parent = vnode.$parent;
        if (parent) {
          const p2 = parent.props || parent.$props || {};
          const c2 = p2.msgRecord || p2.message || p2.messageRecord || p2.item;
          if (c2 && Array.isArray(c2.elements) && c2.elements.length > 0) {
            return { msgRecord: c2, el, props: p2 };
          }
        }
      }
    }
    el = el.parentElement;
  }
  return null;
}

export function isDarkTheme() {
  const theme =
    document.body.getAttribute("q-theme") || document.documentElement.getAttribute("q-theme");
  if (theme) {
    return theme.includes("dark");
  }
  const bg = getComputedStyle(document.body).backgroundColor;
  const match = bg.match(/\d+/g);
  if (match && match.length >= 3) {
    const [r, g, b] = match.map(Number);
    return r * 0.299 + g * 0.587 + b * 0.114 < 128;
  }
  return false;
}

// 从 CSS background-image 中解析 url(...)
function extractBgUrl(el) {
  const bg = getComputedStyle(el).backgroundImage;
  const m = bg && bg.match(/url\(["']?(.*?)["']?\)/);
  return m ? m[1] : "";
}

// 判断一个 url 是否像头像
function looksLikeAvatar(url) {
  return /qlogo\.cn|appavatar|nt_data\/Avatar|\/avatar|头像/i.test(url);
}

// 在给定范围内查找头像（<img> 或 background-image），返回 { img, url }
function findAvatarIn(scope) {
  // 1) 头像容器里的 img
  let el = scope.querySelector(
    ".avatar-span img, .avatar img, img.avatar, .q-avatar img, .message__avatar img, [class*='avatar'] img, [class*='Avatar'] img"
  );
  if (el && el.src) return { img: el, url: el.src };

  // 2) src 像头像的任意 img
  el = Array.from(scope.querySelectorAll("img")).find((img) => looksLikeAvatar(img.src));
  if (el && el.src) return { img: el, url: el.src };

  // 3) 头像容器（class 含 avatar）用了 background-image
  const bgHost = scope.querySelector("[class*='avatar'], [class*='Avatar'], .q-avatar");
  if (bgHost) {
    const url = extractBgUrl(bgHost);
    if (url) return { img: null, url };
  }

  // 4) 扫描范围内所有元素的 background-image，挑出像头像的
  const all = scope.querySelectorAll("*");
  for (const node of all) {
    const url = extractBgUrl(node);
    if (url && looksLikeAvatar(url)) return { img: null, url };
  }
  return { img: null, url: "" };
}

export function getAvatarImg(messageEl) {
  // 头像通常不在消息气泡内部，而在更外层的消息行容器。向上逐级扩大搜索范围。
  let scope = messageEl;
  let result = findAvatarIn(scope);
  for (let i = 0; i < 5 && !result.url && !scope.matches(".message, .ml-item"); i++) {
    if (!scope.parentElement) break;
    scope = scope.parentElement;
    result = findAvatarIn(scope);
  }

  if (!result.url) logMain("未找到头像");
  return result;
}

// 获取发送者昵称。私聊(C2C)场景 msgRecord 常缺 sendMemberName/sendNickName，
// 故按「消息记录字段 → 已渲染的昵称 DOM → 头像 alt/title → 会话标题」逐级兜底。
export function getUserName(messageEl, msgRecord) {
  // 1) 消息记录字段：群名片 → 昵称 → 备注/其它可能字段
  const fromRecord =
    msgRecord?.sendMemberName ||
    msgRecord?.sendNickName ||
    msgRecord?.sendRemarkName ||
    msgRecord?.anonymousExtInfo?.anonymousNick ||
    "";
  if (fromRecord) return fromRecord;

  // 2) 从消息行 DOM 里已渲染的昵称元素取（向上扩大搜索范围）
  let scope = messageEl;
  for (let i = 0; i < 6 && scope; i++) {
    const nameEl = scope.querySelector(
      ".user-name > .text-ellipsis, .message__nickname, .user-name, [class*='nickname'], [class*='Nickname'], [class*='userName'], [class*='UserName']"
    );
    const text = nameEl?.innerText?.trim();
    if (text) return text;
    if (scope.matches(".message, .ml-item")) break;
    scope = scope.parentElement;
  }

  // 3) 头像元素的 alt / title 常是昵称
  const avatarEl = messageEl.querySelector("[class*='avatar'] img, [class*='Avatar'] img, .avatar-span img");
  const alt = (avatarEl?.getAttribute("alt") || avatarEl?.getAttribute("title") || "").trim();
  if (alt) return alt;

  const avatarLabel = messageEl.querySelector(".avatar-span[aria-label]")?.getAttribute("aria-label")?.trim();
  if (avatarLabel) return avatarLabel;

  // 4) 私聊兜底：用当前会话标题（对方昵称）
  const isSelf = !!messageEl.querySelector(".message-container--self, .container--self");
  const aioTitle = !isSelf && Number(msgRecord?.chatType) === 1 && document.querySelector(".chat-header__contact-name .contact-name, .aio-nickname, .aio-content-title, .chat-header .name");
  const titleText = aioTitle?.innerText?.trim();
  if (titleText) return titleText;

  logMain("未找到昵称");
  return String(msgRecord?.senderUin || msgRecord?.senderUid || "");
}
