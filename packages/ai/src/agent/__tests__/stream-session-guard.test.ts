import { describe, it, expect } from 'vitest'
import {
  claimAgentStreamSession,
  isAgentStreamSessionClaimActive,
  releaseAgentStreamSession,
  resetAgentStreamSessionGuardForTests
} from '../stream-session-guard'

describe('stream-session-guard', () => {
  it('supersedes previous claim for the same session', () => {
    resetAgentStreamSessionGuardForTests()

    const first = claimAgentStreamSession('s1')
    const second = claimAgentStreamSession('s1')

    expect(isAgentStreamSessionClaimActive('s1', first.generation)).toBe(false)
    expect(isAgentStreamSessionClaimActive('s1', second.generation)).toBe(true)
    expect(first.signal.aborted).toBe(true)
    expect(second.signal.aborted).toBe(false)
  })

  it('keeps independent claims for different sessions', () => {
    resetAgentStreamSessionGuardForTests()

    const a = claimAgentStreamSession('s1')
    const b = claimAgentStreamSession('s2')

    expect(isAgentStreamSessionClaimActive('s1', a.generation)).toBe(true)
    expect(isAgentStreamSessionClaimActive('s2', b.generation)).toBe(true)
    expect(a.signal.aborted).toBe(false)
    expect(b.signal.aborted).toBe(false)
  })

  it('releases only the matching generation', () => {
    resetAgentStreamSessionGuardForTests()

    const claim = claimAgentStreamSession('s1')
    releaseAgentStreamSession('s1', claim.generation)

    expect(isAgentStreamSessionClaimActive('s1', claim.generation)).toBe(false)
  })
})
