import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { Keyboard, ScrollView } from 'react-native'
import { type PromptShortcut } from '@baishou/shared'
import { type InputBarRef } from '@baishou/ui/native'
import { useTranslation } from 'react-i18next'
import { useMobilePromptShortcuts } from '../../../hooks/useMobilePromptShortcuts'
import { useTTS } from '../../../hooks/useTTS'
import { useBranchSession } from '../../../hooks/useBranchSession'
import { useStreamError } from '../../../hooks/useStreamError'
import type { useNativeToast } from '@baishou/ui/native'

type Toast = ReturnType<typeof useNativeToast>

export function useAgentScreenInteractions(deps: {
  drawerOpen: boolean
  showShortcutSheet: boolean
  showRecallSheet: boolean
  showCostDialog?: boolean
  resetKeyboardInset: () => void
  inputBarRef: RefObject<InputBarRef | null>
  flatListRef: RefObject<ScrollView | null>
  handleComposerFocus: () => void
  beginFollowIfAtBottom: (listRef: RefObject<ScrollView | null>) => void
  handleSend: (
    text: string,
    attachments?: unknown[],
    sendSearchMode?: boolean,
    meta?: {
      displayText?: string
      skillRefs?: Array<{ command: string; content: string }>
      fileRefs?: unknown[]
    }
  ) => Promise<boolean>
  setShowShortcutSheet: (open: boolean) => void
  currentSessionId: string | null
  currentAssistantName: string | undefined
  refreshSessionList?: () => void
  handleSelectSession?: (sessionId: string) => Promise<void> | void
  streamError: string | null
  isStreaming: boolean
  toast: Toast
  messages?: Array<{ id: string; role: string; content?: string }>
  ttsMode?: 'manual' | 'always'
}) {
  const { t } = useTranslation()
  const {
    drawerOpen,
    showShortcutSheet,
    showRecallSheet,
    showCostDialog = false,
    resetKeyboardInset,
    inputBarRef,
    flatListRef,
    handleComposerFocus,
    beginFollowIfAtBottom,
    handleSend,
    setShowShortcutSheet,
    currentSessionId,
    currentAssistantName,
    refreshSessionList,
    handleSelectSession,
    streamError,
    isStreaming,
    toast,
    messages,
    ttsMode
  } = deps

  const {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts,
    reloadShortcuts
  } = useMobilePromptShortcuts()
  const { ttsPlayingMsgId, handleTtsReadAloud } = useTTS()
  const { branchSession } = useBranchSession()
  useStreamError(streamError, isStreaming)

  const awaitingAutoTtsRef = useRef(false)

  useEffect(() => {
    if (isStreaming && currentSessionId) {
      awaitingAutoTtsRef.current = true
    }
  }, [isStreaming, currentSessionId])

  useEffect(() => {
    if (!currentSessionId || streamError) {
      awaitingAutoTtsRef.current = false
    }
  }, [currentSessionId, streamError])

  useEffect(() => {
    if (
      awaitingAutoTtsRef.current &&
      !isStreaming &&
      ttsMode === 'always' &&
      messages &&
      messages.length > 0
    ) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'assistant' && lastMsg.content?.trim()) {
        awaitingAutoTtsRef.current = false
        void handleTtsReadAloud(lastMsg.content, lastMsg.id)
      }
    }
  }, [messages, isStreaming, ttsMode, handleTtsReadAloud, currentSessionId])

  useEffect(() => {
    if (showShortcutSheet) {
      void reloadShortcuts?.()
    }
  }, [showShortcutSheet, reloadShortcuts])

  const handleInputBarFocus = useCallback(() => {
    handleComposerFocus()
    // 仅在已跟随底部时贴底；用户上滑阅读时聚焦输入框不应强制拽到底
    requestAnimationFrame(() => beginFollowIfAtBottom(flatListRef))
  }, [handleComposerFocus, beginFollowIfAtBottom, flatListRef])

  const handleSendWithScroll = useCallback(
    async (
      text: string,
      attachments?: unknown[],
      sendSearchMode?: boolean,
      meta?: {
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
        fileRefs?: unknown[]
      }
    ): Promise<boolean> => {
      resetKeyboardInset()
      inputBarRef.current?.blur()
      Keyboard.dismiss()
      beginFollowIfAtBottom(flatListRef)
      const ok = await handleSend(text, attachments, sendSearchMode, meta)
      if (ok) {
        requestAnimationFrame(() => {
          beginFollowIfAtBottom(flatListRef)
        })
      }
      return ok
    },
    [resetKeyboardInset, inputBarRef, beginFollowIfAtBottom, handleSend, flatListRef]
  )

  useEffect(() => {
    const overlaysOpen = drawerOpen || showShortcutSheet || showRecallSheet || showCostDialog
    if (!overlaysOpen) return
    resetKeyboardInset()
    inputBarRef.current?.blur()
    const frame = requestAnimationFrame(() => {
      Keyboard.dismiss()
    })
    return () => cancelAnimationFrame(frame)
  }, [
    drawerOpen,
    showShortcutSheet,
    showRecallSheet,
    showCostDialog,
    resetKeyboardInset,
    inputBarRef
  ])

  const handleShortcutSelect = useCallback(
    (shortcut: PromptShortcut) => {
      setShowShortcutSheet(false)
      inputBarRef.current?.applyShortcut(shortcut)
    },
    [setShowShortcutSheet, inputBarRef]
  )

  const handleBranch = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return
      try {
        const newSessionId = await branchSession(currentSessionId, messageId, currentAssistantName)
        if (newSessionId) {
          refreshSessionList?.()
          await handleSelectSession?.(newSessionId)
          toast.showSuccess(t('agent.chat.branch_success', '分支创建成功'))
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('app.unknown_error', '未知网络或系统错误')
        toast.showError(msg)
      }
    },
    [
      currentSessionId,
      branchSession,
      currentAssistantName,
      refreshSessionList,
      handleSelectSession,
      t,
      toast
    ]
  )

  return {
    shortcuts,
    addShortcut,
    updateShortcut,
    deleteShortcut,
    reorderShortcuts,
    ttsPlayingMsgId,
    handleTtsReadAloud,
    handleInputBarFocus,
    handleSendWithScroll,
    handleShortcutSelect,
    handleBranch
  }
}
