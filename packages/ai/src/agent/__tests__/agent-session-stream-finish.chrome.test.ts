import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-session-stream-finish.ts'),
  'utf8'
)

describe('agent session stream finish chrome', () => {
  it('should report first-output timeout instead of treating it as a user stop', () => {
    expect(src).toContain('isAgentStreamUserAborted')
    expect(src).toContain('isAgentFirstOutputTimeoutError')
  })

  it('should complete a waiting companion_ask when the user stops the stream', () => {
    expect(src).toContain('applyRejectedCompanionAskResults')
    expect(src).toMatch(/isAgentGateRejectedError\(streamError\)\s*\|\|\s*userAborted/)
  })

  it('should fail incomplete tools and report unexpected abort as an error', () => {
    expect(src).toContain('applyFailedIncompleteToolResults')
    expect(src).toContain('UNEXPECTED_AGENT_STREAM_ABORT_MESSAGE')
    expect(src).toContain('abortSignal?.aborted')
    expect(src).toMatch(/existingAssistantMessageId,\s*userAborted/)
  })

  it('should persist the round instead of aborting it as a doom-loop interrupt', () => {
    expect(src).not.toContain('检测到工具调用死循环，已中断本轮')
    expect(src).not.toContain('Skip persist for session ${sessionId}: doom-loop')
  })
})
