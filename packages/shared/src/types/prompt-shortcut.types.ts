/**
 * AI 模型快捷指令
 */
export interface PromptShortcut {
  id: string;      // 唯一标识号 (通常为 uuid 或生成时间戳)
  icon: string;    // Emoji 或图标代号
  name: string;    // 快捷指令名称
  content: string; // 快捷指令系统提示词正文
}
