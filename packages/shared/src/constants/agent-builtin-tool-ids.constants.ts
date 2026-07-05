/**
 * 工具管理页「内置工具」Tab 中的可配置工具 ID。
 * 与 registry 中的 Agent 工具名一致（不含 auto_inject_time 等仅 UI 使用的虚拟项）。
 */
export const AGENT_BUILTIN_TOOL_IDS = [
  'diary_read',
  'diary_edit',
  'diary_delete',
  'diary_list',
  'diary_search',
  'summary_read',
  'message_search',
  'vector_search',
  'memory_store',
  'memory_delete'
] as const

export type AgentBuiltinToolId = (typeof AGENT_BUILTIN_TOOL_IDS)[number]

export const AGENT_BUILTIN_TOOL_ID_SET = new Set<string>(AGENT_BUILTIN_TOOL_IDS)

export function isAgentBuiltinToolId(toolId: string): toolId is AgentBuiltinToolId {
  return AGENT_BUILTIN_TOOL_ID_SET.has(toolId)
}
