import { describe, expect, it } from 'vitest'
import {
  AgentGateNotFoundError,
  AgentGateRejectedError,
  isAgentGateNotFoundError,
  isAgentGateRejectedError
} from '../agent-gate.errors'

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

describe('isAgentGateNotFoundError', () => {
  it('should recognize AgentGateNotFoundError instances', () => {
    expect(isAgentGateNotFoundError(new AgentGateNotFoundError('bag_1'))).toBe(true)
  })

  it('should recognize the desktop IPC wrapper around a missing gate request', () => {
    expect(
      isAgentGateNotFoundError(
        new Error(
          "Error invoking remote method 'agent-gate:reply': AgentGateNotFoundError: 门控请求不存在：bag_1"
        )
      )
    ).toBe(true)
  })

  it('should ignore ordinary errors', () => {
    expect(isAgentGateNotFoundError(new Error('network down'))).toBe(false)
  })
})
