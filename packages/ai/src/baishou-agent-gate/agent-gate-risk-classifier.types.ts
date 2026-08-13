import type {
  AgentGatePreview,
  AgentGateResourceRef
} from '@baishou/shared'

/** auto_review 模型风险分类结果 */
export type AgentGateRiskVerdict = 'allow' | 'ask'

export interface AgentGateRiskClassifierInput {
  action: string
  title: string
  description?: string
  preview?: AgentGatePreview
  resources?: readonly AgentGateResourceRef[]
  sessionId?: string
}

export interface AgentGateRiskClassifierResult {
  verdict: AgentGateRiskVerdict
  /** 可选：展示在权限卡上的简短理由 */
  reason?: string
}

/**
 * 可选注入：仅在 securityMode=auto_review 且规则已 Allow 时调用。
 * 失败时应由调用方 fail-closed 升为 ask。
 */
export type AgentGateRiskClassifier = (
  input: AgentGateRiskClassifierInput
) => Promise<AgentGateRiskClassifierResult>
