import type { LucideIcon } from 'lucide-react'

/** 工具 id → Lucide 图标名（与 desktop agent-tools.constants 一致） */
export const AGENT_TOOL_ICON_IDS = {
  diary_read: 'BookOpen',
  diary_edit: 'PenSquare',
  diary_delete: 'Trash2',
  diary_list: 'List',
  diary_search: 'Search',
  summary_read: 'FileText',
  message_search: 'MessageSquare',
  vector_search: 'ScanSearch',
  memory_store: 'Database',
  memory_delete: 'DatabaseZap',
  auto_inject_time: 'Clock'
} as const satisfies Record<string, keyof typeof import('lucide-react')>

export const AGENT_TOOL_CATEGORY_ICON_IDS = {
  diary: 'Book',
  summary: 'FileText',
  memory: 'Palette',
  search: 'Globe',
  general: 'Puzzle'
} as const satisfies Record<string, keyof typeof import('lucide-react')>

export type AgentToolIconId = keyof typeof AGENT_TOOL_ICON_IDS
export type AgentToolCategoryIconId = keyof typeof AGENT_TOOL_CATEGORY_ICON_IDS

export type LucideIconComponent = LucideIcon
