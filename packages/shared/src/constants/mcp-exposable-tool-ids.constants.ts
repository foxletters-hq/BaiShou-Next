import { AGENT_BUILTIN_TOOL_IDS } from './agent-builtin-tool-ids.constants'

/** 仅伙伴本机使用，不经 MCP 对外暴露 */
const MCP_HIDDEN_BUILTIN_TOOL_IDS = new Set(['skill_write'])

/** MCP 对外暴露的工具 ID（伙伴内置工具，不含仅本机写入的技能保存） */
export const MCP_EXPOSABLE_TOOL_IDS = AGENT_BUILTIN_TOOL_IDS.filter(
  (id) => !MCP_HIDDEN_BUILTIN_TOOL_IDS.has(id)
) as readonly (typeof AGENT_BUILTIN_TOOL_IDS)[number][]

export type McpExposableToolId = (typeof MCP_EXPOSABLE_TOOL_IDS)[number]

export const MCP_EXPOSABLE_TOOL_ID_SET = new Set<string>(MCP_EXPOSABLE_TOOL_IDS)

export function isMcpExposableToolId(toolId: string): toolId is McpExposableToolId {
  return MCP_EXPOSABLE_TOOL_ID_SET.has(toolId)
}
