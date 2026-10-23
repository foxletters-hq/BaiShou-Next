import { describe, expect, it } from 'vitest'
import {
  shouldCountTokensSinceLastSnapshot,
  shouldEvaluateCompressionAfterResend
} from '../agent-session-recompress.util'

describe('agent session recompress after resend', () => {
  it('should evaluate compression on a normal send even without a snapshot', () => {
    expect(
      shouldEvaluateCompressionAfterResend({
        forceRecompress: false,
        hasCompressionSnapshot: false
      })
    ).toBe(true)
  })

  it('should skip compression on resend when there is no remaining snapshot', () => {
    expect(
      shouldEvaluateCompressionAfterResend({
        forceRecompress: true,
        hasCompressionSnapshot: false
      })
    ).toBe(false)
  })

  it('should re-evaluate compression on resend only when a snapshot remains', () => {
    expect(
      shouldEvaluateCompressionAfterResend({
        forceRecompress: true,
        hasCompressionSnapshot: true
      })
    ).toBe(true)
  })

  it('should count only tokens since the last snapshot when resending with a snapshot', () => {
    expect(
      shouldCountTokensSinceLastSnapshot({
        forceRecompress: true,
        hasCompressionSnapshot: true
      })
    ).toBe(true)
  })

  it('should not use snapshot-increment tokens on a normal send', () => {
    expect(
      shouldCountTokensSinceLastSnapshot({
        forceRecompress: false,
        hasCompressionSnapshot: true
      })
    ).toBe(false)
  })
})
