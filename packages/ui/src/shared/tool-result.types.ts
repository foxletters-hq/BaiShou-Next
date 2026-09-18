/** 工具调用结果解析 — 展示层类型 */

export interface ToolInvocationLike {
  toolCallId?: string
  toolName?: string
  result?: unknown
  args?: unknown
}

export type CompanionAskOptionView = {
  id: string
  label: string
}

export type CompanionAskPresentation = {
  mode: 'companion_ask'
  question: string
  answer: string | null
  declined: boolean
  options: CompanionAskOptionView[]
  selectedOptionIds: string[]
}

export type ToolResultPresentation =
  | { mode: 'plain'; text: string; renderAsMarkdown: boolean; sourceUrl?: string }
  | { mode: 'structured'; data: unknown }
  | { mode: 'error'; text: string }
  | CompanionAskPresentation

export type ToolCopyTranslate = (
  key: string,
  fallbackOrOptions?: string | { defaultValue?: string; [key: string]: unknown }
) => unknown
