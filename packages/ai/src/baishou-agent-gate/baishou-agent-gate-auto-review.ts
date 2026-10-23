import { AgentGateEffect, i18n, type AgentGateAssertInput } from '@baishou/shared'
import type {
  AgentGateRiskClassifier,
  AgentGateRiskClassifierResult
} from './agent-gate-risk-classifier.types'

export type AutoReviewResult = {
  assertInput: AgentGateAssertInput
  effect: AgentGateEffect
  detailedOverride?: {
    effect: AgentGateEffect
    decisionSource: {
      layer: 'session'
      action: 'auto_review'
      effect: AgentGateEffect
      clampedFrom: AgentGateEffect
    }
  }
}

export function shouldApplyAutoReview(_input: {
  effect: AgentGateEffect
  assertInput: AgentGateAssertInput
  turnAllowed: boolean
  safeRisk: boolean
  securityMode?: string
  isAutoAccept?: () => boolean
  riskClassifier?: AgentGateRiskClassifier
}): boolean {
  // 工作台已收敛为 full_access / allow_list 两档模式，不再使用模型自动审核
  return false
}

function askOverride(): NonNullable<AutoReviewResult['detailedOverride']> {
  return {
    effect: AgentGateEffect.Ask,
    decisionSource: {
      layer: 'session',
      action: 'auto_review',
      effect: AgentGateEffect.Ask,
      clampedFrom: AgentGateEffect.Allow
    }
  }
}

export function applyAutoReviewClassification(
  assertInput: AgentGateAssertInput,
  effect: AgentGateEffect,
  classified: AgentGateRiskClassifierResult
): AutoReviewResult {
  if (classified.verdict !== 'ask') {
    return { assertInput, effect }
  }
  const reason = classified.reason?.trim()
  if (!reason) {
    return { assertInput, effect: AgentGateEffect.Ask, detailedOverride: askOverride() }
  }
  return {
    assertInput: {
      ...assertInput,
      description: reason,
      metadata: {
        ...(assertInput.metadata ?? {}),
        autoReviewReason: reason
      }
    },
    effect: AgentGateEffect.Ask,
    detailedOverride: askOverride()
  }
}

export function applyAutoReviewClassifierFailed(
  assertInput: AgentGateAssertInput
): AutoReviewResult {
  return {
    assertInput: {
      ...assertInput,
      description:
        assertInput.description ??
        i18n.t(
          'settings.agent_gate_auto_review_incomplete',
          '自动审核未能完成，已改为需要你确认。'
        ),
      metadata: {
        ...(assertInput.metadata ?? {}),
        autoReviewReason: 'classifier_failed'
      }
    },
    effect: AgentGateEffect.Ask,
    detailedOverride: askOverride()
  }
}
