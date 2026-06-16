/** 未配置命名模型时，从用户首条消息截取标题的默认长度（对齐桌面 createSession） */
export const SESSION_TITLE_FROM_USER_TEXT_MAX_LENGTH = 10

/**
 * 从用户发送内容推导会话标题（无命名模型时的回退策略）。
 */
export function deriveSessionTitleFromUserText(
  text: string,
  maxLength = SESSION_TITLE_FROM_USER_TEXT_MAX_LENGTH
): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  return trimmed.substring(0, maxLength)
}
