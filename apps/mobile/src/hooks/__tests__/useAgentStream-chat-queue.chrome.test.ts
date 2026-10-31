import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { getSharedSessionInbox, resetSharedSessionInboxForTests } from '@baishou/ai'

const currentDir = dirname(fileURLToPath(import.meta.url))
const chatHookSrc = readFileSync(join(currentDir, '../useAgentStream-chat.ts'), 'utf8')
const actionsHookSrc = readFileSync(join(currentDir, '../useAgentStream-actions.ts'), 'utf8')
const pendingQueueHookSrc = readFileSync(join(currentDir, '../useMobilePendingQueue.ts'), 'utf8')
const controllerSrc = readFileSync(
  join(currentDir, '../../screens/AgentScreen/hooks/useAgentScreenController.ts'),
  'utf8'
)
const chatListSrc = readFileSync(
  join(currentDir, '../../screens/AgentScreen/components/AgentChatList.tsx'),
  'utf8'
)
const queueBarSrc = readFileSync(
  join(currentDir, '../../screens/AgentScreen/components/MobileComposerRuntimeQueueBar.tsx'),
  'utf8'
)
const msgServiceSrc = readFileSync(
  join(currentDir, '../../services/mobile-agent-message.service.ts'),
  'utf8'
)

describe('useAgentStream-chat session queue and inbox', () => {
  it('should use inbox.admit instead of unconditioned claim/interrupt on send', () => {
    expect(chatHookSrc).toContain('getSharedSessionInbox')
    expect(chatHookSrc).toContain('isAgentStreamSessionBusy')
    expect(chatHookSrc).toContain('releaseAgentStreamSession')
    expect(chatHookSrc).toContain('getSharedSessionInbox().admit(')

    const handleSendSnippet = chatHookSrc.slice(
      chatHookSrc.indexOf('const handleSend = useCallback(')
    )
    expect(handleSendSnippet).not.toMatch(
      /userStoppedStreamRef\.current = false\s+interruptActiveStream/
    )
  })

  it('should release claim in finally block during stream execution', () => {
    expect(chatHookSrc).toMatch(
      /finally\s*\{\s*releaseAgentStreamSession\(sessionId, claim\.generation\)/
    )
  })

  it('should schedule idle drain when stream finishes or queued message arrives while busy', () => {
    expect(chatHookSrc).toContain('scheduleMobileDrainWhenIdle')
    expect(chatHookSrc).toContain('drainAgainSessionsRef.current.add(sessionId)')
    expect(chatHookSrc).toContain('onClaimReplaced?.(claim)')
    // Reserve orderIndex + 2 when the previous message is still a user message (assistant in flight)
    expect(msgServiceSrc).toContain("lastMsg?.role === 'user' ? lastOrder + 2 : lastOrder + 1")
  })

  it('should use clean bgSurface instead of muddy gray bgSurfaceNormal on queue items', () => {
    expect(queueBarSrc).toContain('colors.bgSurface')
    expect(queueBarSrc).not.toContain('colors.bgSurfaceNormal')
    expect(queueBarSrc).not.toContain('colors.bgSurfaceHigh')
  })

  it('should support steerPendingInput for immediate send of queued items and cancel pending on message deletion', () => {
    expect(chatHookSrc).toContain("setPendingDelivery(inputId, 'steer')")
    expect(actionsHookSrc).toContain('getSharedSessionInbox().cancelAllPending(currentSessionId)')
  })

  it('should wire MobileComposerRuntimeQueueBar, MobileComposerQueueEditTag, and excludePendingQueuedUserMessages', () => {
    expect(chatListSrc).toContain('allowSendWhileLoading')
    expect(chatListSrc).toContain('MobileComposerQueueTopSlot')
    expect(queueBarSrc).toContain('MobileComposerRuntimeQueueBar')
    expect(queueBarSrc).toContain('MobileComposerQueueEditTag')
    expect(controllerSrc).toContain('useMobilePendingQueue')
    expect(controllerSrc).toContain('excludePendingQueuedUserMessages')
    expect(pendingQueueHookSrc).toContain('getSharedSessionInbox().subscribe')
  })

  it('should notify SessionInbox subscribers on admit, updatePendingText, setPendingDelivery, promoteNext, and cancelInput', () => {
    resetSharedSessionInboxForTests()
    const inbox = getSharedSessionInbox()
    const listener = vi.fn()
    const unsubscribe = inbox.subscribe(listener)

    const item = inbox.admit({
      sessionId: 's-mobile-1',
      text: 'queued hello',
      delivery: 'queue',
      userMessageId: 'u-1'
    })
    expect(listener).toHaveBeenCalledWith('s-mobile-1')

    listener.mockClear()
    inbox.updatePendingText(item.id, 'edited hello')
    expect(listener).toHaveBeenCalledWith('s-mobile-1')
    expect(inbox.listPending('s-mobile-1')[0]?.text).toBe('edited hello')

    listener.mockClear()
    inbox.setPendingDelivery(item.id, 'steer')
    expect(listener).toHaveBeenCalledWith('s-mobile-1')
    expect(inbox.listPending('s-mobile-1')[0]?.delivery).toBe('steer')

    listener.mockClear()
    const promoted = inbox.promoteNext('s-mobile-1')
    expect(promoted?.id).toBe(item.id)
    expect(listener).toHaveBeenCalledWith('s-mobile-1')
    expect(inbox.listPending('s-mobile-1')).toHaveLength(0)

    unsubscribe()
  })
})
