/**
 * AI 模型快捷指令
 */
export interface PromptShortcut {
  id: string
  icon?: string
  name?: string
  content: string
  /** 快捷短语，用于 `/` 匹配 */
  command?: string
  tag?: string
  description?: string
}
