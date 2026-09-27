import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const inboxSrc = readFileSync(path.resolve(__dirname, '../workspace-chat-inbox.ts'), 'utf8')
const composerSrc = readFileSync(
  path.resolve(
    __dirname,
    '../../../renderer/src/features/agent-workspace/workbench/WorkbenchAgentComposer.tsx'
  ),
  'utf8'
)

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

  it('should show queue bar actions for send now edit and delete when pending exists', () => {
    expect(composerSrc).toContain('ComposerRuntimeQueueBar')
    expect(composerSrc).toContain('onQueueSendNow')
    expect(composerSrc).toContain('onQueueEdit')
    expect(composerSrc).toContain('ComposerQueueEditTag')
  })
})
