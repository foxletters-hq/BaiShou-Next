import { useCallback, useEffect, useState } from 'react'
import { getSharedSessionInbox, reconcileCompressionStateAfterTruncate } from '@baishou/ai'
import { cleanupAttachmentsForParts } from '@baishou/core-mobile'
import { useAgentStore } from '@baishou/store'
import type { SessionInputRecord } from '@baishou/shared'

import { useBaishou } from '../providers/BaishouProvider'
import { runMobileAgentDbWrite } from '../services/mobile-agent-db-write.util'
import type { MobileRuntimeQueueItem } from '../screens/AgentScreen/components/MobileComposerRuntimeQueueBar'

function toQueueItems(list: SessionInputRecord[]): MobileRuntimeQueueItem[] {
  return list.map((item) => ({
    id: item.id,
    text: item.text,
    userMessageId: item.userMessageId
  }))
}

export function useMobilePendingQueue(params: {
  sessionId: string | null
  refreshSessionMessages?: (
    sessionId: string,
    options?: { preserveWindow?: boolean; commitToUi?: boolean }
  ) => Promise<boolean>
  onSteerSendNow?: (sessionId: string, inputId: string) => Promise<void> | void
}) {
  const { sessionId, refreshSessionMessages, onSteerSendNow } = params
  const { services } = useBaishou()
  const [pendingQueue, setPendingQueue] = useState<MobileRuntimeQueueItem[]>([])
  const [editingInputId, setEditingInputId] = useState<string | null>(null)

  const refreshPending = useCallback(() => {
    if (!sessionId) {
      setPendingQueue((prev) => (prev.length === 0 ? prev : []))
      setEditingInputId(null)
      return
    }
    const list = getSharedSessionInbox().listPending(sessionId)
    setPendingQueue(toQueueItems(list))
    setEditingInputId((prev) => (prev && list.some((item) => item.id === prev) ? prev : null))
  }, [sessionId])

  useEffect(() => {
    refreshPending()
    const unsubscribe = getSharedSessionInbox().subscribe((changedSessionId) => {
      if (sessionId && changedSessionId === sessionId) {
        refreshPending()
      }
    })
    return unsubscribe
  }, [refreshPending, sessionId])

  const beginEdit = useCallback((item: MobileRuntimeQueueItem) => {
    setEditingInputId(item.id)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingInputId(null)
  }, [])

  const commitEdit = useCallback(
    async (text: string): Promise<boolean> => {
      if (!editingInputId) return false
      const trimmed = text.trim()
      if (!trimmed) return false
      const updated = getSharedSessionInbox().updatePendingText(editingInputId, trimmed)
      if (!updated) return false
      const userMessageId = updated.userMessageId?.trim()
      if (userMessageId && services) {
        try {
          await runMobileAgentDbWrite(
            `updateQueuedMessage(${updated.sessionId})`,
            async (runtime) => {
              await runtime.sessionRepo.updateMessageTextPart(userMessageId, trimmed)
              await runtime.sessionManager.flushSessionToDisk(updated.sessionId)
            }
          )
          useAgentStore.getState().updateMessage(userMessageId, { content: trimmed })
        } catch (err) {
          console.warn('Failed to update queued user message in DB:', err)
        }
      }
      setEditingInputId(null)
      refreshPending()
      return true
    },
    [editingInputId, refreshPending, services]
  )

  const deleteItem = useCallback(
    async (item: MobileRuntimeQueueItem): Promise<void> => {
      const cancelled = getSharedSessionInbox().cancelInput(item.id)
      if (editingInputId === item.id) {
        setEditingInputId(null)
      }
      refreshPending()
      if (!cancelled) return
      const userMessageId = cancelled.userMessageId?.trim()
      const sid = cancelled.sessionId
      if (userMessageId && services) {
        try {
          await runMobileAgentDbWrite(`deleteQueuedMessage(${sid})`, async (runtime) => {
            const ids = await runtime.sessionRepo.listMessageIdsFromMessageAndFollowing(
              sid,
              userMessageId
            )
            const parts = ids.length > 0 ? await runtime.sessionRepo.getPartsByMessageIds(ids) : []
            await runtime.sessionRepo.deleteMessageAndFollowing(sid, userMessageId)
            if (runtime.snapshotRepo) {
              await reconcileCompressionStateAfterTruncate(
                runtime.sessionRepo,
                runtime.snapshotRepo,
                sid
              )
            }
            if (services.attachmentManager) {
              await cleanupAttachmentsForParts(services.attachmentManager, sid, parts)
            }
            await runtime.sessionManager.flushSessionToDisk(sid)
          })
          if (refreshSessionMessages) {
            await refreshSessionMessages(sid, { preserveWindow: true, commitToUi: true })
          }
        } catch (err) {
          console.warn('Failed to delete queued user message from DB:', err)
        }
      }
    },
    [editingInputId, refreshPending, refreshSessionMessages, services]
  )

  const sendNow = useCallback(
    async (item: MobileRuntimeQueueItem): Promise<void> => {
      if (!sessionId) return
      if (editingInputId === item.id) {
        setEditingInputId(null)
      }
      await onSteerSendNow?.(sessionId, item.id)
      refreshPending()
    },
    [editingInputId, onSteerSendNow, refreshPending, sessionId]
  )

  return {
    pendingQueue,
    editingInputId,
    refreshPending,
    beginEdit,
    cancelEdit,
    commitEdit,
    deleteItem,
    sendNow
  }
}
