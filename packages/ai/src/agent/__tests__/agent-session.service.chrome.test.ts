import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'agent-session.service.ts'),
  'utf8'
)

describe('agent session service chrome', () => {
  it('should keep a still-open companion_ask but clear other gates when the stream ends', () => {
    expect(src).toContain("sessionAgentGate?.cancelSession(sessionId, 'stream ended'")
    expect(src).toContain("keepRequest: (request) => request.action === 'companion_ask'")
    expect(src).not.toContain('keepCompanionAsk')
  })
})
