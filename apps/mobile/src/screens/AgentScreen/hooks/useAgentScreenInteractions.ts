import { useCallback, useEffect, type RefObject } from 'react'
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
}) {
  const { t } = useTranslation()
  const {
    drawerOpen,
    showShortcutSheet,
    showRecallSheet,
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
    toast
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
      Keyboard.dismiss()
      beginFollowIfAtBottom(flatListRef)
      return handleSend(text, attachments, sendSearchMode, meta)
    },
    [resetKeyboardInset, beginFollowIfAtBottom, handleSend, flatListRef]
  )

  useEffect(() => {
    const overlaysOpen = drawerOpen || showShortcutSheet || showRecallSheet
    if (!overlaysOpen) return
    resetKeyboardInset()
    inputBarRef.current?.blur()
    const frame = requestAnimationFrame(() => {
      Keyboard.dismiss()
    })
    return () => cancelAnimationFrame(frame)
  }, [drawerOpen, showShortcutSheet, showRecallSheet, resetKeyboardInset, inputBarRef])

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
