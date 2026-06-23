export class AgentGateDeniedError extends Error {
  readonly code = 'agent_gate.denied' as const

  constructor(
    readonly action: string,
    message?: string
  ) {
    super(message ?? `操作「${action}」已被禁用，无法执行。`)
    this.name = 'AgentGateDeniedError'
  }
}

export class AgentGateRejectedError extends Error {
  readonly code = 'agent_gate.rejected' as const

  constructor(message = '用户拒绝了本次操作。') {
    super(message)
    this.name = 'AgentGateRejectedError'
  }
}

export class AgentGateCorrectedError extends Error {
  readonly code = 'agent_gate.corrected' as const

  constructor(readonly feedback: string) {
    super(`用户拒绝了本次操作，并说明：${feedback}`)
    this.name = 'AgentGateCorrectedError'
  }
}

export class AgentGateNotFoundError extends Error {
  readonly code = 'agent_gate.not_found' as const

  constructor(readonly requestId: string) {
    super(`门控请求不存在：${requestId}`)
    this.name = 'AgentGateNotFoundError'
  }
}

export class AgentGateCancelledError extends Error {
  readonly code = 'agent_gate.cancelled' as const

  constructor(message = '门控请求已取消。') {
    super(message)
    this.name = 'AgentGateCancelledError'
  }
}

export class AgentGateAlwaysNotAllowedError extends Error {
  readonly code = 'agent_gate.always_not_allowed' as const

  constructor(readonly action: string) {
    super(`操作「${action}」在排除列表中，不能设为始终允许。`)
    this.name = 'AgentGateAlwaysNotAllowedError'
  }
}
