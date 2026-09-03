import { AgentGateKind, type AgentGateRequest } from '@baishou/shared'
import type { CompanionAskPresentation } from '../../shared/tool-result.util'

export function presentationFromCompanionAskRequest(
  request: AgentGateRequest
): CompanionAskPresentation {
  return {
    mode: 'companion_ask',
    question: request.title?.trim() ?? '',
    answer: null,
    declined: false,
    options: (request.options ?? []).map((option) => ({
      id: option.id,
      label: option.label
    })),
    selectedOptionIds: []
  }
}

export function matchCompanionAskPendingRequest(
  pending: AgentGateRequest | null | undefined,
  presentation: CompanionAskPresentation | null,
  toolName?: string
): AgentGateRequest | null {
  if (!pending || pending.action !== 'companion_ask') return null
  if (pending.kind && pending.kind !== AgentGateKind.Proactive) return null
  if (toolName && toolName !== 'companion_ask') return null
  if (presentation?.declined) return null
  if (presentation?.selectedOptionIds.length) return null
  if (presentation?.answer) return null
  const question = presentation?.question?.trim()
  const title = pending.title?.trim()
  if (question && title && question !== title) return null
  return pending
}
