import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const chatHookSrc = readFileSync(join(currentDir, '../useAgentStream-chat.ts'), 'utf8')
const actionsHookSrc = readFileSync(join(currentDir, '../useAgentStream-actions.ts'), 'utf8')
const chatListSrc = readFileSync(
  join(currentDir, '../../screens/AgentScreen/components/AgentChatList.tsx'),
  'utf8'
)

describe('useAgentStream-chat session queue and inbox', () => {
  it('should use inbox.admit instead of unconditioned claim/interrupt on send', () => {
    // 验证引入了 inbox 工具函数与 claim 释放函数
    expect(chatHookSrc).toContain('getSharedSessionInbox')
    expect(chatHookSrc).toContain('isAgentStreamSessionBusy')
    expect(chatHookSrc).toContain('releaseAgentStreamSession')

    // 验证 handleSend 中使用了 inbox.admit
    expect(chatHookSrc).toContain('getSharedSessionInbox().admit(')

    // 验证 handleSend 中没有无条件调用 claimAgentStreamSession
    const handleSendSnippet = chatHookSrc.slice(chatHookSrc.indexOf('const handleSend = useCallback('))
    expect(handleSendSnippet).not.toMatch(/userStoppedStreamRef\.current = false\s+interruptActiveStream/)
  })

  it('should release claim in finally block during stream execution', () => {
    expect(chatHookSrc).toMatch(/finally\s*\{\s*releaseAgentStreamSession\(sessionId, claim\.generation\)/)
  })

  it('should cancel all pending inbox messages on handleStop', () => {
    expect(actionsHookSrc).toContain('getSharedSessionInbox().cancelAllPending(sessionId)')
  })

  it('should pass allowSendWhileLoading to InputBar in AgentChatList', () => {
    expect(chatListSrc).toContain('allowSendWhileLoading')
  })
})
