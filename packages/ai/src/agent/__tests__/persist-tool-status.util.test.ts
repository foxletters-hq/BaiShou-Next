import { describe, expect, it } from 'vitest'
import { resolvePersistedToolStatus } from '../persist-tool-status.util'

describe('resolvePersistedToolStatus', () => {
  it('should keep a waiting companion_ask as running instead of failed', () => {
    expect(
      resolvePersistedToolStatus({
        toolName: 'companion_ask',
        status: 'running',
        hasResult: false
      })
    ).toBe('running')
  })

  it('should mark other running tools as failed when the stream is checkpointed', () => {
    expect(
      resolvePersistedToolStatus({
        toolName: 'workspace_list',
        status: 'running',
        hasResult: false
      })
    ).toBe('failed')
  })

  it('should keep a completed tool with a result', () => {
    expect(
      resolvePersistedToolStatus({
        toolName: 'companion_ask',
        status: 'completed',
        hasResult: true
      })
    ).toBe('completed')
  })

  it('should keep a real companion_ask failure', () => {
    expect(
      resolvePersistedToolStatus({
        toolName: 'companion_ask',
        status: 'failed',
        hasResult: false
      })
    ).toBe('failed')
  })
})
