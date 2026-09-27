import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const flowSrc = [
  readFileSync(path.resolve(__dirname, '../useAgentChatFlow.ts'), 'utf8'),
  readFileSync(path.resolve(__dirname, '../commit-companion-queue-edit.ts'), 'utf8')
].join('\n')
const screenSrc = readFileSync(path.resolve(__dirname, '../../AgentScreen.tsx'), 'utf8')

describe('companion busy send uses admit queue', () => {
  it('should admit through inbox when sending instead of starting chat directly', () => {
    expect(flowSrc).toContain('window.api.admit(')
    expect(flowSrc).not.toMatch(/stream\s*\n\s*\.startChat\(/)
    expect(flowSrc).not.toContain('.startChat(')
  })

  it('should render queue bar and allow send while loading when composer is busy', () => {
    expect(screenSrc).toContain('ComposerRuntimeQueueBar')
    expect(screenSrc).toContain('allowSendWhileLoading')
    expect(screenSrc).toContain('excludePendingQueuedUserMessages')
  })
})
