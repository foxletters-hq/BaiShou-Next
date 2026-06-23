/** 用户级信任模式 */
export enum AgentGateTrustMode {
  Manual = 'manual',
  FullTrust = 'full_trust'
}

/** 门控请求来源 */
export enum AgentGateKind {
  Tool = 'tool',
  Proactive = 'proactive',
  Lifecycle = 'lifecycle'
}

/** 策略评估结果 */
export enum AgentGateEffect {
  Allow = 'allow',
  Ask = 'ask',
  Deny = 'deny'
}

/** 请求生命周期 */
export enum AgentGateRequestStatus {
  Pending = 'pending',
  Resolved = 'resolved',
  Cancelled = 'cancelled'
}

/** 用户单次回复 */
export enum AgentGateReply {
  Once = 'once',
  Always = 'always',
  Reject = 'reject'
}

/** 工具风险等级 */
export enum AgentGateRiskLevel {
  Safe = 'safe',
  Mutating = 'mutating',
  Destructive = 'destructive'
}
