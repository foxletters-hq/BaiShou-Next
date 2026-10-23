import { AgentGateEffect, AgentGateProfileId, resolveAgentGateProfileId } from '@baishou/shared'
import type { ToolContext } from './agent.tool'

export function hasEmbeddingCapability(context: ToolContext): boolean {
  if (context.userConfig?.['hasEmbeddingModel'] === true) return true
  return Boolean(context.embeddingService && context.vectorStore)
}

function resolveGateProfile(context: ToolContext): AgentGateProfileId {
  if (context.gateProfile) {
    return resolveAgentGateProfileId(context.gateProfile)
  }
  if (context.workspace?.sessionKind === 'workspace') {
    return AgentGateProfileId.Workspace
  }
  return AgentGateProfileId.Companion
}

/** 伙伴设为拒绝，或已写入 disabledToolIds 时，内置工具不得再经 MCP 暴露或执行。 */
export function isNamedToolDenied(name: string, context: ToolContext): boolean {
  const disabledIds = Array.isArray(context.userConfig?.['disabledToolIds'])
    ? (context.userConfig!['disabledToolIds'] as string[])
    : []
  if (disabledIds.includes(name)) return true

  const gate = context.agentGate
  if (!gate?.probeEffect) return false

  const rawConfig = context.userConfig?.['baishou_agent_gate_config'] as
    | { hideDeniedTools?: boolean }
    | undefined
  if (rawConfig?.hideDeniedTools === false) return false

  return (
    gate.probeEffect({
      action: name,
      profileId: resolveGateProfile(context)
    }) === AgentGateEffect.Deny
  )
}

/** 将运行时已接好的向量能力同步回 userConfig，供 MCP tools/list 与 Agent 过滤一致 */
export function syncMcpToolUserConfig(context: ToolContext): ToolContext {
  const userConfig = { ...(context.userConfig ?? {}) }

  if (context.embeddingService && context.vectorStore) {
    userConfig.hasEmbeddingModel = true
  }

  if (userConfig.ragEnabled === undefined) {
    userConfig.ragEnabled = true
  }

  return { ...context, userConfig }
}
