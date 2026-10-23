import { describe, expect, it } from 'vitest'
import { AgentGateRejectedError } from '@baishou/shared'
import {
  shouldReadStreamUsageAfterInterrupt,
  shouldWarnLimitedPersist
} from '../persist-stream-interrupt.util'

describe('persist stream interrupt', () => {
  it('should not warn when the user stopped the stream', () => {
    const abort = new DOMException('The operation was aborted', 'AbortError')
    expect(shouldWarnLimitedPersist(abort, { userAborted: true })).toBe(false)
    expect(shouldReadStreamUsageAfterInterrupt(abort, { userAborted: true })).toBe(true)
  })

  it('should warn when the stream aborted without the user stopping', () => {
    const abort = new DOMException('The operation was aborted', 'AbortError')
    expect(shouldWarnLimitedPersist(abort, { userAborted: false })).toBe(true)
    expect(shouldReadStreamUsageAfterInterrupt(abort, { userAborted: false })).toBe(false)
  })

  it('should not warn when the user rejected a gate', () => {
    const rejected = new AgentGateRejectedError()
    expect(shouldWarnLimitedPersist(rejected)).toBe(false)
    expect(shouldReadStreamUsageAfterInterrupt(rejected)).toBe(true)
  })

  it('should warn only for unexpected stream failures', () => {
    const failure = new Error('模型未返回任何内容')
    expect(shouldWarnLimitedPersist(failure)).toBe(true)
    expect(shouldReadStreamUsageAfterInterrupt(failure)).toBe(false)
  })
})
