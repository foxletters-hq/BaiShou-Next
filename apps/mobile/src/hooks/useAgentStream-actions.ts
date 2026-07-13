import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useAgentStore } from '@baishou/store'
import { reconcileCompressionStateAfterTruncate } from '@baishou/ai'
import { cleanupAttachmentsForParts } from '@baishou/core-mobile'
import {
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  isAgentStreamAbortError
} from '@baishou/shared'

import { useBaishou } from '../providers/BaishouProvider'
import type { AgentStreamRefs } from './useAgentStream-types'

interface UseAgentStreamActionsOptions {
  refs: AgentStreamRefs
  currentSessionId: string | null
  currentProviderId: string | null
  currentModelId: string | null
  bumpReloadEpoch?: () => void
  setStreamError: (value: string | null) => void
  setIsCompressing: (value: boolean) => void
  setCompressionText: (value: string) => void
  setCompressionReasoning: (value: string) => void
  setCompressionTriggerMessageId: (value: string | null) => void
  flushStreamingDisplayBuffers: () => void
  stopStreamingUiImmediately: () => void
  resetStreamingBuffers: () => void
  resetCompressionBuffers: () => void
  interruptActiveStream: () => void
  finishStream: (
    sessionId: string,
    options?: { waitForLatestUsage?: boolean; releaseRetryEpoch?: number }
  ) => Promise<void>
  reloadMessagesFromDb: (
    sessionId: string,
    options?: {
      preserveWindow?: boolean
      retryCount?: number
      waitForLatestUsage?: boolean
      commitToUi?: boolean
    }
  ) => Promise<boolean>
  truncateSessionAndSyncUi: (
    sessionId: string,
    cutoffOrderIndex: number,
    epoch: number
  ) => Promise<boolean>
  streamFromExistingUserMessage: (
    sessionId: string,
    userMessage: { id: string; content: string; attachments?: unknown[] },
    options?: { retryReleaseEpoch?: number }
  ) => Promise<void>
}

export function useAgentStreamActions({
  refs,
  currentSessionId,
  currentProviderId,
  currentModelId,
  bumpReloadEpoch,
  setStreamError,
  setIsCompressing,
  setCompressionText,
  setCompressionReasoning,
  setCompressionTriggerMessageId,
  flushStreamingDisplayBuffers,
  stopStreamingUiImmediately,
  resetStreamingBuffers,
  resetCompressionBuffers,
  interruptActiveStream,
  finishStream,
  reloadMessagesFromDb,
  truncateSessionAndSyncUi,
  streamFromExistingUserMessage
}: UseAgentStreamActionsOptions) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { updateMessage, messages } = useAgentStore()
  const { services } = useBaishou()

  const [isRetryActionBusy, setIsRetryActionBusy] = useState(false)

  const {
    retryEpochRef,
    finishStreamPassRef,
    isStreamingRef,
    isStreamBridgeActiveRef,
    streamPresentationLingerRef,
    retryActionInFlightRef,
    pendingRetryReleaseEpochRef,
    userStoppedStreamRef,
    currentSessionIdRef
  } = refs

  const beginRetryAction = useCallback(() => {
    const epoch = ++retryEpochRef.current
    finishStreamPassRef.current += 1
    bumpReloadEpoch?.()
    interruptActiveStream()
    resetCompressionBuffers()
    setIsCompressing(false)
    setCompressionText('')
    setCompressionReasoning('')
    setCompressionTriggerMessageId(null)
    return epoch
  }, [
    retryEpochRef,
    finishStreamPassRef,
    bumpReloadEpoch,
    interruptActiveStream,
    resetCompressionBuffers,
    setIsCompressing,
    setCompressionText,
    setCompressionReasoning,
    setCompressionTriggerMessageId
  ])

  const releaseRetryAction = useCallback(() => {
    retryActionInFlightRef.current = false
    pendingRetryReleaseEpochRef.current = null
    setIsRetryActionBusy(false)
  }, [retryActionInFlightRef, pendingRetryReleaseEpochRef])

  const acquireRetryAction = useCallback((): number | null => {
    if (
      retryActionInFlightRef.current ||
      isStreamingRef.current ||
      isStreamBridgeActiveRef.current ||
      streamPresentationLingerRef.current
    ) {
      return null
    }
    retryActionInFlightRef.current = true
    setIsRetryActionBusy(true)
    return beginRetryAction()
  }, [
    retryActionInFlightRef,
    isStreamingRef,
    isStreamBridgeActiveRef,
    streamPresentationLingerRef,
    beginRetryAction
  ])

  const releaseRetryActionIfSetupFailed = useCallback(
    (epoch: number) => {
      if (pendingRetryReleaseEpochRef.current !== null) return
      if (epoch !== retryEpochRef.current) return
      releaseRetryAction()
    },
    [pendingRetryReleaseEpochRef, retryEpochRef, releaseRetryAction]
  )

  const handleStop = useCallback(() => {
    const sessionId = currentSessionIdRef.current
    userStoppedStreamRef.current = true
    finishStreamPassRef.current += 1
    setStreamError(null)
    flushStreamingDisplayBuffers()
    stopStreamingUiImmediately()
    resetStreamingBuffers()
    toast.showSuccess(t('agent.stream_cancelled', '取消成功'))

    if (retryActionInFlightRef.current) {
      pendingRetryReleaseEpochRef.current = null
      releaseRetryAction()
    }

    if (sessionId) {
      void finishStream(sessionId, { waitForLatestUsage: true })
    }
  }, [
    currentSessionIdRef,
    userStoppedStreamRef,
    finishStreamPassRef,
    setStreamError,
    flushStreamingDisplayBuffers,
    stopStreamingUiImmediately,
    resetStreamingBuffers,
    retryActionInFlightRef,
    pendingRetryReleaseEpochRef,
    releaseRetryAction,
    finishStream,
    toast,
    t
  ])

  const confirmMessageRetry = useCallback(async () => {
    return dialog.confirm(
      t(
        'agent.chat.retry_confirm',
        '重新发送将删除此消息之后的对话记录，此操作不可撤销。确定继续吗？'
      ),
      {
        title: t('agent.chat.retry', '重新发送/生成'),
        confirmText: t('common.confirm', '确定'),
        destructive: true
      }
    )
  }, [dialog, t])

  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return

      const confirmed = await confirmMessageRetry()
      if (!confirmed) return

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      const epoch = acquireRetryAction()
      if (epoch === null) return

      const failRegenerate = (errorMsg: string) => {
        if (epoch !== retryEpochRef.current) return
        if (userStoppedStreamRef.current || isAgentStreamAbortError(errorMsg)) return
        setStreamError(errorMsg)
      }

      try {
        const msgIndex = messages.findIndex((m) => m.id === messageId)
        if (msgIndex <= 0) {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        const userMessage = messages[msgIndex - 1]
        if (userMessage.role !== 'user') {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }

        const dbUser = await services.sessionRepo.getMessageById(userMessage.id)
        if (!dbUser || !services.snapshotRepo) {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        if (epoch !== retryEpochRef.current) return

        const synced = await truncateSessionAndSyncUi(currentSessionId, dbUser.orderIndex, epoch)
        if (!synced) {
          releaseRetryActionIfSetupFailed(epoch)
          toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
          return
        }

        await streamFromExistingUserMessage(
          currentSessionId,
          {
            id: userMessage.id,
            content: userMessage.content,
            attachments: userMessage.attachments
          },
          { retryReleaseEpoch: epoch }
        )
      } catch (e) {
        if (userStoppedStreamRef.current || isAgentStreamAbortError(e)) {
          userStoppedStreamRef.current = false
          setStreamError(null)
        } else {
          const msg = e instanceof Error ? e.message : String(e)
          failRegenerate(msg)
        }
        releaseRetryActionIfSetupFailed(epoch)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      currentProviderId,
      currentModelId,
      toast,
      t,
      confirmMessageRetry,
      acquireRetryAction,
      releaseRetryActionIfSetupFailed,
      streamFromExistingUserMessage,
      truncateSessionAndSyncUi,
      retryEpochRef,
      userStoppedStreamRef,
      setStreamError
    ]
  )

  const handleResend = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services?.snapshotRepo) return
      const storeMsg = messages.find((m) => m.id === messageId)
      if (!storeMsg || storeMsg.role !== 'user') return

      const confirmed = await confirmMessageRetry()
      if (!confirmed) return

      const epoch = acquireRetryAction()
      if (epoch === null) return

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg) {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        if (epoch !== retryEpochRef.current) return

        const synced = await truncateSessionAndSyncUi(currentSessionId, dbMsg.orderIndex, epoch)
        if (!synced) {
          releaseRetryActionIfSetupFailed(epoch)
          toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
          return
        }

        await streamFromExistingUserMessage(
          currentSessionId,
          {
            id: messageId,
            content: storeMsg.content,
            attachments: storeMsg.attachments
          },
          { retryReleaseEpoch: epoch }
        )
      } catch (e) {
        if (epoch !== retryEpochRef.current) return
        console.error('Failed to resend message', e)
        toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
        releaseRetryActionIfSetupFailed(epoch)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      acquireRetryAction,
      releaseRetryActionIfSetupFailed,
      streamFromExistingUserMessage,
      truncateSessionAndSyncUi,
      toast,
      t,
      confirmMessageRetry,
      retryEpochRef
    ]
  )

  const handleEditMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !services?.snapshotRepo || !newContent.trim()) return

      const epoch = acquireRetryAction()
      if (epoch === null) return

      try {
        const dbMsg = await services.sessionRepo.getMessageById(messageId)
        if (!dbMsg || dbMsg.role !== 'user') {
          releaseRetryActionIfSetupFailed(epoch)
          return
        }
        if (epoch !== retryEpochRef.current) return

        await services.sessionRepo.updateMessageTextPart(messageId, newContent.trim())
        if (epoch !== retryEpochRef.current) return

        const synced = await truncateSessionAndSyncUi(currentSessionId, dbMsg.orderIndex, epoch)
        if (!synced) {
          releaseRetryActionIfSetupFailed(epoch)
          toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
          return
        }

        const storeMsg = messages.find((m) => m.id === messageId)
        await streamFromExistingUserMessage(
          currentSessionId,
          {
            id: messageId,
            content: newContent.trim(),
            attachments: storeMsg?.attachments
          },
          { retryReleaseEpoch: epoch }
        )
      } catch (e) {
        if (epoch !== retryEpochRef.current) return
        console.error('Failed to edit message', e)
        toast.showError(t('agent.chat.resend_failed', '重新发送失败'))
        releaseRetryActionIfSetupFailed(epoch)
      }
    },
    [
      currentSessionId,
      services,
      messages,
      acquireRetryAction,
      releaseRetryActionIfSetupFailed,
      streamFromExistingUserMessage,
      truncateSessionAndSyncUi,
      toast,
      t,
      retryEpochRef
    ]
  )

  const handleSaveAssistantEdit = useCallback(
    async (messageId: string, newContent: string) => {
      if (!services || !newContent.trim()) return
      try {
        await services.sessionRepo.updateMessageTextPart(messageId, newContent.trim())
        updateMessage(messageId, { content: newContent.trim() })
      } catch (e) {
        console.error('Failed to save assistant message edit', e)
        toast.showError(t('common.save_failed', '保存失败'))
      }
    },
    [services, updateMessage, toast, t]
  )

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!currentSessionId || !services) return
      const confirmed = await dialog.confirm(
        t('agent.chat.delete_msg_confirm', '您确定要删除这条消息历史吗？此操作不可逆转。'),
        { confirmText: t('common.delete', '删除'), destructive: true }
      )
      if (!confirmed) return
      bumpReloadEpoch?.()
      try {
        const ids = await services.sessionRepo.listMessageIdsFromMessageAndFollowing(
          currentSessionId,
          messageId
        )
        const parts = ids.length > 0 ? await services.sessionRepo.getPartsByMessageIds(ids) : []
        await services.sessionRepo.deleteMessageAndFollowing(currentSessionId, messageId)
        if (services.snapshotRepo) {
          await reconcileCompressionStateAfterTruncate(
            services.sessionRepo,
            services.snapshotRepo,
            currentSessionId
          )
        }
        await cleanupAttachmentsForParts(services.attachmentManager, currentSessionId, parts)
        await services.sessionManager.flushSessionToDisk(currentSessionId)
        const synced = await reloadMessagesFromDb(currentSessionId, { preserveWindow: false })
        if (!synced) {
          toast.showError(t('common.delete_failed', '删除失败'))
        }
      } catch (e) {
        console.error('Failed to delete message', e)
        toast.showError(t('common.delete_failed', '删除失败'))
      }
    },
    [currentSessionId, services, dialog, t, toast, reloadMessagesFromDb, bumpReloadEpoch]
  )

  return {
    isRetryActionBusy,
    releaseRetryAction,
    handleStop,
    handleRegenerate,
    handleResend,
    handleEditMessage,
    handleSaveAssistantEdit,
    handleDeleteMessage
  }
}
