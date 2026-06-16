/** 伙伴类型：亲密伙伴拥有日记与记忆工具；工作伙伴仅协助知识与工作 */
export type AssistantKind = 'companion' | 'work'

export const DEFAULT_ASSISTANT_KIND: AssistantKind = 'companion'

/** 工作伙伴默认禁用的工具（在全局工具开关基础上追加） */
export const WORK_ASSISTANT_DISABLED_TOOL_IDS = [
  'diary_write',
  'diary_edit',
  'diary_delete',
  'diary_read',
  'diary_list',
  'diary_search',
  'summary_read',
  'memory_store',
  'memory_delete',
  'vector_search',
  'message_search'
] as const

export function getAssistantDisabledToolIds(kind?: AssistantKind | string | null): string[] {
  if (kind === 'work') return [...WORK_ASSISTANT_DISABLED_TOOL_IDS]
  return []
}

export function mergeDisabledToolIds(
  globalDisabled: string[],
  assistantKind?: AssistantKind | string | null
): string[] {
  return [...new Set([...globalDisabled, ...getAssistantDisabledToolIds(assistantKind)])]
}

export function normalizeAssistantKind(kind?: string | null): AssistantKind {
  return kind === 'work' ? 'work' : 'companion'
}

/** 伙伴类型小标签配色（浅绿 / 浅蓝） */
export const ASSISTANT_KIND_BADGE_THEME = {
  companion: { bg: '#DCFCE7', text: '#15803D' },
  work: { bg: '#DBEAFE', text: '#1D4ED8' }
} as const

export function getAssistantKindBadgeTheme(kind?: AssistantKind | string | null) {
  const normalized = normalizeAssistantKind(kind)
  return ASSISTANT_KIND_BADGE_THEME[normalized]
}

export function getAssistantKindLabelKey(kind?: AssistantKind | string | null): string {
  return normalizeAssistantKind(kind) === 'work'
    ? 'agent.assistant.kind_work'
    : 'agent.assistant.kind_companion'
}

export function getAssistantKindHintKey(kind?: AssistantKind | string | null): string {
  return normalizeAssistantKind(kind) === 'work'
    ? 'agent.assistant.kind_work_description'
    : 'agent.assistant.kind_companion_description'
}
