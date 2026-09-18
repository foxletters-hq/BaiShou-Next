import { describe, expect, it } from 'vitest'
import { AgentGateRejectedError, isAgentGateRejectedError } from '../agent-gate.errors'

describe('isAgentGateRejectedError', () => {
  it('should recognize AgentGateRejectedError instances', () => {
    expect(isAgentGateRejectedError(new AgentGateRejectedError())).toBe(true)
  })

  it('should recognize wrapped rejected errors', () => {
    expect(
      isAgentGateRejectedError({
        name: 'AI_ToolExecutionError',
        message: 'tool failed',
        cause: new AgentGateRejectedError()
      })
    ).toBe(true)
  })

  it('should ignore ordinary errors', () => {
    expect(isAgentGateRejectedError(new Error('network down'))).toBe(false)
  })
})
