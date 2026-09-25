import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-session.service.ts'),
  'utf8'
)

describe('agent session service chrome', () => {
  it('should not cancel a still-open companion_ask when the model stream ends', () => {
    expect(src).toContain('shouldKeepCompanionAskAfterStream')
    expect(src).toContain("sessionAgentGate?.listPending(sessionId)")
    expect(src).toContain("sessionAgentGate?.cancelSession(sessionId, 'stream ended')")
    expect(src).toContain('if (!keepCompanionAsk)')
  })
})
