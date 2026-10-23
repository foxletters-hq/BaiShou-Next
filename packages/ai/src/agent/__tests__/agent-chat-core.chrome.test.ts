import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-chat-core.service.ts'),
  'utf8'
)

describe('agent chat core chrome', () => {
  it('should surface first-output timeout instead of treating it as a user stop', () => {
    expect(src).toContain('isAgentFirstOutputTimeoutError')
  })

  it('should send onError as a stream error instead of success', () => {
    expect(src).toContain('params.emitter.sendFinish(params.sessionId, { error: err.message })')
    expect(src).not.toContain(
      'isAgentStreamAbortError(err) && !isAgentFirstOutputTimeoutError(err)'
    )
  })

  it('should drop a hung compression lock when a new stream claims the session', () => {
    expect(src).toContain('claimAgentStreamSession(params.sessionId)')
    expect(src).toContain('clearCompressionSessionLock(params.sessionId)')
    expect(src).toContain('clearPendingAgentStreamStop(params.sessionId)')
  })
})
