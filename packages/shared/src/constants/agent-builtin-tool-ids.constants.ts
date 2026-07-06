import { AGENT_TOOL_UI_DEFS, AGENT_TOOL_UI_ONLY_IDS } from './agent-tools-ui.constants'

const UI_ONLY_TOOL_ID_SET = new Set<string>(AGENT_TOOL_UI_ONLY_IDS)

/**
 * 工具管理页「内置工具」Tab 中的可配置工具 ID。
 * 与 registry 中的 Agent 工具名一致（不含 auto_inject_time 等仅 UI 使用的虚拟项）。
 */
export const AGENT_BUILTIN_TOOL_IDS = AGENT_TOOL_UI_DEFS.filter(
  (tool) => !UI_ONLY_TOOL_ID_SET.has(tool.id)
).map((tool) => tool.id)

export type AgentBuiltinToolId = (typeof AGENT_BUILTIN_TOOL_IDS)[number]

export const AGENT_BUILTIN_TOOL_ID_SET = new Set<string>(AGENT_BUILTIN_TOOL_IDS)

export function isAgentBuiltinToolId(toolId: string): toolId is AgentBuiltinToolId {
  return AGENT_BUILTIN_TOOL_ID_SET.has(toolId)
}
