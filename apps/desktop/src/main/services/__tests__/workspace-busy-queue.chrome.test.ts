import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const inboxSrc = readFileSync(path.resolve(__dirname, '../workspace-chat-inbox.ts'), 'utf8')

describe('workspace busy admit does not interrupt', () => {
  it('should resolve admit start with stream claim busy check when forceStart is set', () => {
    expect(inboxSrc).toContain('resolveAdmitStartDecision')
    expect(inboxSrc).toContain('isAgentStreamSessionBusy')
    expect(inboxSrc).not.toMatch(/if \(params\.forceStart\) \{\s*if \(isWorkspaceSessionStreaming/)
  })

  it('should drain after idle when send-now steers a pending input', () => {
    expect(inboxSrc).toContain('scheduleDrainWhenIdle')
    expect(inboxSrc).toContain("params.delivery === 'steer'")
  })
})
