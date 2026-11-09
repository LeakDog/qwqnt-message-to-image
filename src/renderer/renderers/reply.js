// reply 渲染器：QQ 原样引用块（气泡内侧顶部浅灰条 + 发件人 + 摘要）
import { makeNode, registerElementRenderer } from "../ir.js";
import { truncateText } from "./text-at.js";
import { MSG_BOX_MAX_WIDTH, REPLY_ACCENT, REPLY_GAP, REPLY_PAD_X, REPLY_PAD_Y, REPLY_LINE_H } from "../constants.js";

// 被回复消息内容占位：图片/文件/空 → 显示 [图片]/[文件]/[原消息已删除]
function replySummaryText(reply, messageEl) {
  const text = reply.sourceMsgText || (reply.sourceMsgTextElems || []).map((el) => {
    if (el.textElemContent) return el.textElemContent;
    if (el.picElem) return "[图片]";
    if (el.faceElem) return "[表情]";
    return "";
  }).join("") || messageEl?.querySelector(".reply-element .reply-content")?.textContent?.trim();
  if (text) return String(text);
  if (reply.sourceMsgIsIncPic) return "[图片]";
  return reply.sourceMsgExpired || reply.replyMsgRevokeType ? "原消息已删除" : "[引用消息]";
}

registerElementRenderer("reply", {
  parse(el, ctxInfo) {
    if (!el?.replyElement) return null;
    const r = el.replyElement;
    const sender = r.replyMsgSenderName || r.anonymousNickName ||
      ctxInfo?.messageEl?.querySelector(".reply-element .reply-info")?.textContent?.trim() ||
      r.replyMsgSenderUin || r.senderUid || "";
    const summary = replySummaryText(r, ctxInfo?.messageEl);
    if (!sender && !summary) return null;
    return makeNode("reply", false, { sender, summary });
  },
  // 块级节点：测量引用块宽度（= 内容宽，封顶 MSG_BOX_MAX_WIDTH）与高度（发件人+摘要两行）
  measure(ctx, node) {
    const { sender, summary } = node.data;
    ctx.font = "12px " + (ctx.font.split("px ").slice(1).join("px ") || "sans-serif");
    let contentW = 0;
    if (sender) contentW = Math.max(contentW, ctx.measureText(sender).width);
    if (summary) contentW = Math.max(contentW, ctx.measureText(summary).width);
    const w = Math.min(contentW + REPLY_PAD_X * 2 + REPLY_ACCENT + REPLY_GAP, MSG_BOX_MAX_WIDTH);
    let lines = 0;
    if (sender) lines++;
    if (summary) lines++;
    const h = lines * REPLY_LINE_H + REPLY_PAD_Y * 2 + 4;
    return { w, h };
  },
  draw(node, x, y, drawCtx) {
    const { ctx, fontFamily, colors } = drawCtx;
    const { sender, summary } = node.data;
    const boxWidth = node.w || MSG_BOX_MAX_WIDTH;
    const boxHeight = node.h || 0;

    // 引用块背景（半透明浅灰）
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = colors.contextColor;
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 6);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 左侧色条（原生蓝）
    ctx.fillStyle = colors.atColor;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 4, REPLY_ACCENT, boxHeight - 8, 2);
    ctx.fill();

    // 发件人 + 摘要，各一行，逐行截断
    ctx.font = "12px " + fontFamily;
    ctx.fillStyle = colors.contextColor;
    let ty = y + REPLY_LINE_H - 4;
    if (sender) {
      ctx.fillText(
        truncateText(ctx, sender, boxWidth - REPLY_PAD_X * 2 - REPLY_ACCENT - REPLY_GAP),
        x + REPLY_PAD_X + REPLY_ACCENT + REPLY_GAP,
        ty
      );
      ty += REPLY_LINE_H;
    }
    if (summary) {
      ctx.fillText(
        truncateText(ctx, summary, boxWidth - REPLY_PAD_X * 2 - REPLY_ACCENT - REPLY_GAP),
        x + REPLY_PAD_X + REPLY_ACCENT + REPLY_GAP,
        ty
      );
    }
    ctx.restore();
  },
});
