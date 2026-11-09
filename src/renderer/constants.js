// 常量与颜色：所有渲染相关的共享配置集中在此。
export const IR_VERSION = 1;

// 消息气泡内容区最大宽度（逻辑像素），与 QQ 气泡宽度对齐
export const MSG_BOX_MAX_WIDTH = 340;

// 渲染倍率上限，防止超大 canvas 导致进程 OOM
export const MAX_SCALE = 8;

// 主题色（light / dark）
export const COLORS = {
  userName: { light: "#999999", dark: "#808080" },
  msgBox: { light: "#ffffff", dark: "#262626" },
  context: { light: "#333333", dark: "#f2f2f2" },
  at: { light: "#1B6EFF", dark: "#4E8CFF" },
  time: { light: "#999999", dark: "#808080" },
};

// 回复引用块样式常量
export const REPLY_ACCENT = 3; // 左侧色条宽
export const REPLY_GAP = 6; // 色条与文本间距
export const REPLY_PAD_X = 10; // 水平内边距
export const REPLY_PAD_Y = 6; // 垂直内边距
export const REPLY_LINE_H = 18; // 行高
