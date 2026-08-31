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
  /** 缺省视为 software：安装目录技能；workspace 为当前项目内技能 */
  source?: 'software' | 'workspace'
}
