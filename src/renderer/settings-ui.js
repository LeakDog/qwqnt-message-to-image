// Shadow DOM 隔离 QQ / 第三方主题的 input 重置规则，主题颜色仍由 CSS 变量继承。
import { normalizeConfig, readConfig, writeConfig } from "./config.js";

let setPluginConfig = () => {};
export function bindSettingsState({ setConfig }) {
  setPluginConfig = setConfig || (() => {});
}

const titleBindings = new WeakMap();
function bindPageTitle(view) {
  titleBindings.get(view)?.();
  const tabs = document.querySelector(".setting-tab");
  const title = document.querySelector(".setting-title");
  if (!tabs || !title) return;
  let original = null;
  const textNodes = () => [...title.childNodes].filter(node => node.nodeType === Node.TEXT_NODE);
  function restore() {
    if (!original) return;
    for (const [node, text] of original) if (node.parentNode === title) node.textContent = text;
    original = null;
  }
  function update(event) {
    const nav = event?.target.closest?.(".nav-item") || tabs.querySelector(".nav-item-active");
    if (nav?.dataset.name !== "qwqnt-message-to-image") { restore(); return; }
    const nodes = textNodes();
    if (!original) original = nodes.map(node => [node, node.textContent]);
    nodes.forEach((node, index) => { node.textContent = index === 0 ? " 消息转图片" : ""; });
  }
  // 捕获阶段先恢复原生标题，让 QQ / hako 后续的页面切换处理正常更新。
  tabs.addEventListener("click", update, true);
  update();
  titleBindings.set(view, () => { tabs.removeEventListener("click", update, true); restore(); });
}

export function buildSettingsUI(view) {
  const cfg = readConfig();
  setPluginConfig(cfg);
  view.replaceChildren();
  const host = document.createElement("div");
  host.className = "m2i-settings-host";
  view.appendChild(host);
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { display:block; min-width:0; color:var(--text_primary, #333); font:14px/1.6 system-ui, sans-serif; }
      *, *::before, *::after { box-sizing:border-box; }
      .settings { padding:20px 16px; max-width:760px; margin:0 auto; }
      h2 { margin:0 0 6px; font-size:18px; font-weight:600; }
      .description, .hint { color:var(--text_secondary, #888); font-size:12px; }
      .description { margin:0 0 24px; }
      .field { margin:0 0 20px; padding:16px; border:1px solid var(--border_primary, #8886); border-radius:10px; }
      label { display:block; font-weight:500; margin-bottom:10px; }
      .control { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
      input { min-width:0; height:36px; padding:7px 10px; border:1px solid var(--border_primary, #8888); border-radius:6px;
        background:var(--fill_standard_primary, #8882); color:var(--text_primary, #333); font:inherit; }
      input:focus { outline:2px solid var(--brand_standard, #3987ff); outline-offset:1px; }
      input::placeholder { color:var(--text_secondary, #888); }
      input[type=number] { width:110px; }
      input[type=text] { width:100%; }
      .hint { margin:10px 0 0; overflow-wrap:anywhere; }
      .status { min-height:20px; margin-top:6px; font-size:12px; color:var(--text_secondary, #888); }
      .status.error { color:var(--text_error, #e55); }
      @media(max-width:480px) { .settings { padding:16px 4px; } .field { padding:12px; } }
    </style>
    <section class="settings" aria-label="消息转图片设置">
      <h2>消息转图片</h2>
      <p class="description">右键消息或在多选工具栏点击「转图片」导出 PNG。修改后自动保存，下次转图片生效。</p>
      <div class="field">
        <label for="m2i-scale">渲染倍率</label>
        <div class="control"><input id="m2i-scale" type="number" min="1" max="8" step="1" aria-describedby="scale-hint" /><span>倍</span></div>
        <p class="hint" id="scale-hint">1 倍为原始尺寸，2 倍为高清，最高支持 8 倍。</p>
        <div class="status" id="scale-status" role="status" aria-live="polite"></div>
      </div>
      <div class="field">
        <label for="m2i-path">保存目录</label>
        <input id="m2i-path" type="text" placeholder="留空则每次弹出保存对话框" aria-describedby="path-hint" spellcheck="false" />
        <p class="hint" id="path-hint">填写已存在的绝对路径，例如 G:\\images。留空时每次选择保存位置。</p>
        <div class="status" id="path-status" role="status" aria-live="polite"></div>
      </div>
    </section>
  `;
  const scale = root.querySelector("#m2i-scale");
  const path = root.querySelector("#m2i-path");
  scale.value = cfg.scale;
  path.value = cfg.savePath;

  function persist(status) {
    const next = normalizeConfig({ scale: scale.value, savePath: path.value });
    const saved = writeConfig(next) === true;
    if (saved) setPluginConfig(next);
    scale.value = next.scale;
    status.textContent = saved ? "已保存" : "保存失败，请检查 hako 是否正常运行后重试";
    status.classList.toggle("error", !saved);
  }
  scale.addEventListener("change", () => persist(root.querySelector("#scale-status")));
  path.addEventListener("change", () => persist(root.querySelector("#path-status")));
  bindPageTitle(view);
}
