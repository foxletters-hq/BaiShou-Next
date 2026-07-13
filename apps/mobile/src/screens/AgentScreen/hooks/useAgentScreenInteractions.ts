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
  handleSend: (text: string, attachments?: unknown[], sendSearchMode?: boolean) => Promise<boolean>
  setShowShortcutSheet: (open: boolean) => void
  currentSessionId: string | null
  currentAssistantName: string | undefined
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
    streamError,
    isStreaming,
    toast
  } = deps

  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, reorderShortcuts } =
    useMobilePromptShortcuts()
  const { ttsPlayingMsgId, handleTtsReadAloud } = useTTS()
  const { branchSession } = useBranchSession()
  useStreamError(streamError, isStreaming)

  const handleInputBarFocus = useCallback(() => {
    handleComposerFocus()
    // 仅在已跟随底部时贴底；用户上滑阅读时聚焦输入框不应强制拽到底
    requestAnimationFrame(() => beginFollowIfAtBottom(flatListRef))
  }, [handleComposerFocus, beginFollowIfAtBottom, flatListRef])

  const handleSendWithScroll = useCallback(
    async (text: string, attachments?: unknown[], sendSearchMode?: boolean): Promise<boolean> => {
      beginFollowIfAtBottom(flatListRef)
      return handleSend(text, attachments, sendSearchMode)
    },
    [beginFollowIfAtBottom, handleSend, flatListRef]
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
      if (shortcut.content.trim()) {
        inputBarRef.current?.insertShortcutContent(shortcut.content.trim())
      }
    },
    [setShowShortcutSheet, inputBarRef]
  )

  const handleBranch = useCallback(
    async (messageId: string) => {
      if (!currentSessionId) return
      try {
        const newSessionId = await branchSession(currentSessionId, messageId, currentAssistantName)
        if (newSessionId) {
          toast.showSuccess(t('agent.chat.branch_success', '分支创建成功'))
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : t('app.unknown_error', '未知网络或系统错误')
        toast.showError(msg)
      }
    },
    [currentSessionId, branchSession, currentAssistantName, t, toast]
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
