import { AGENT_BUILTIN_TOOL_IDS } from './agent-builtin-tool-ids.constants'

/** MCP 对外暴露的工具 ID（内置日记/记忆工具 + 公网检索与基础辅助） */
export const MCP_EXPOSABLE_TOOL_IDS = [
  ...AGENT_BUILTIN_TOOL_IDS,
  'diary_write',
  'web_search',
  'url_read',
  'current_time'
] as const

export type McpExposableToolId = (typeof MCP_EXPOSABLE_TOOL_IDS)[number]

export const MCP_EXPOSABLE_TOOL_ID_SET = new Set<string>(MCP_EXPOSABLE_TOOL_IDS)

export function isMcpExposableToolId(toolId: string): toolId is McpExposableToolId {
  return MCP_EXPOSABLE_TOOL_ID_SET.has(toolId)
}
