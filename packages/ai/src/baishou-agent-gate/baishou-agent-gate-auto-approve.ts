import {
  AgentGateEffect,
  AgentGateKind,
  AgentGateReply,
  extractAgentGateResourcesFromMetadata,
  mergeAgentGateResources,
  type AgentGateAssertInput
} from '@baishou/shared'
import type { IBaishouAgentGate } from './baishou-agent-gate.types'

/**
 * 外部 MCP 客户端免确认：Ask 直接放行，Deny / 排除列表 / 禁用工具仍然拦截。
 * Proactive 提问不受影响，仍会正常等待用户回答。
 */
export function createAutoApproveAgentGate(gate: IBaishouAgentGate): IBaishouAgentGate {
  const probe = (input: AgentGateAssertInput) =>
    gate.probeEffect({
      ...input,
      resources: mergeAgentGateResources(
        input.resources,
        extractAgentGateResourcesFromMetadata(input.metadata)
      )
    })

  return {
    assert: async (input) => {
      if (input.kind === AgentGateKind.Proactive) {
        return gate.assert(input)
      }
      if (probe(input) === AgentGateEffect.Deny) {
        return gate.assert(input)
      }
    },

    assertWithResolution: async (input) => {
      if (input.kind !== AgentGateKind.Proactive && probe(input) !== AgentGateEffect.Deny) {
        return {
          requestId: '',
          reply: AgentGateReply.Once,
          resolvedAt: Date.now()
        }
      }
      return gate.assertWithResolution(input)
    },

    ask: (input) => gate.ask(input),
    reply: (input) => gate.reply(input),
    get: (requestId) => gate.get(requestId),
    listPending: (sessionId) => gate.listPending(sessionId),
    cancelSession: (sessionId, reason, options) => gate.cancelSession(sessionId, reason, options),
    probeEffect: (input) => gate.probeEffect(input)
  }
}
