import { useState, useRef, useImperativeHandle, useMemo } from 'react'
import type { InputBarProps, InputBarRef } from './input-bar.types'
import { useInputBarExpand } from './useInputBarExpand'
import { useInputBarAttachments } from './useInputBarAttachments'
import { useInputBarShortcuts } from '../../hooks/useInputBarShortcuts'
import {
  getDefaultShortcutLabelsFromT,
  localizePromptShortcuts,
  type MockChatAttachment
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useComposerDraft } from '../../shared/composer-draft'

export function useInputBar(props: InputBarProps, ref: React.ForwardedRef<InputBarRef>) {
  const {
    isLoading,
    onSend,
    onStop,
    composerBlocked = false,
    onComposerBlocked,
    composerDraftKey,
    composerDraftStorage,
    assistantName,
    onAssistantTap,
    onRecall,
    shortcuts,
    onTriggerShortcut,
    onManageShortcuts,
    onOpenTools,
    searchMode = true,
    onToggleSearchMode,
    ttsMode = 'manual',
    onToggleTtsMode,
    placeholder,
    bottomTrailing,
    footer,
    sendIconSize,
    minRows = 1
  } = props

  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
  const [isSending, setIsSending] = useState(false)
  const { clearDraft } = useComposerDraft({
    draftKey: composerDraftKey,
    draftStorage: composerDraftStorage,
    text,
    setText,
    draftSyncSuspended: isSending
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useInputBarExpand(textareaRef, text, minRows)
  const attachmentHandlers = useInputBarAttachments(setAttachments)
  const localizedShortcuts = useMemo(() => {
    if (!shortcuts?.length) return undefined
    return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
  }, [shortcuts, t, i18n.language])
  const shortcutHandlers = useInputBarShortcuts(text, setText, localizedShortcuts)

  useImperativeHandle(ref, () => ({
    insertText: (newText) => {
      setText((prev) => (prev ? `${prev}\n${newText}` : newText))
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    insertShortcutContent: (content) => {
      shortcutHandlers.insertShortcutContent(content)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    focus: () => textareaRef.current?.focus()
  }))

  const handleSend = async () => {
    if ((!text.trim() && attachments.length === 0) || isLoading || isSending) return
    if (composerBlocked) {
      onComposerBlocked?.()
      return
    }

    const pendingText = text
    const pendingAttachments = attachments.length > 0 ? [...attachments] : []
    const hadSearchMode = searchMode

    setText('')
    setAttachments([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setIsSending(true)
    try {
      const accepted = await Promise.resolve(
        onSend(
          pendingText.trim(),
          pendingAttachments.length > 0 ? pendingAttachments : undefined,
          hadSearchMode
        )
      )
      if (accepted === false) {
        setText(pendingText)
        setAttachments(pendingAttachments)
      } else {
        await clearDraft()
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (shortcutHandlers.handleShortcutKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey) {
      if (shortcutHandlers.shortcutModeActive && text.startsWith('/')) return
      e.preventDefault()
      handleSend()
    }
  }

  const handlePromptShortcut = () => {
    if (onManageShortcuts) onManageShortcuts()
    else if (onTriggerShortcut) onTriggerShortcut()
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    if (shortcuts?.length) {
      shortcutHandlers.handleTextChangeForShortcuts(text, val)
    } else if (val === '/' && text === '' && onTriggerShortcut) {
      onTriggerShortcut()
    }
    setText(val)
  }

  return {
    t,
    text,
    setText,
    attachments,
    setAttachments,
    textareaRef,
    handleSend,
    handleKeyDown,
    fileInputRef: attachmentHandlers.fileInputRef,
    handlePickFiles: attachmentHandlers.handlePickFiles,
    handleNativeWebFileChange: attachmentHandlers.handleNativeWebFileChange,
    handlePaste: attachmentHandlers.handlePaste,
    handleTextChange,
    shortcutModeActive: shortcutHandlers.shortcutModeActive,
    filteredShortcuts: shortcutHandlers.filteredShortcuts,
    shortcutSelectedIndex: shortcutHandlers.selectedIndex,
    applyShortcut: shortcutHandlers.applyShortcut,
    toggleSearchMode: () => onToggleSearchMode?.(),
    handlePromptShortcut,
    isLoading,
    isSending,
    onStop,
    assistantName,
    onAssistantTap,
    onRecall,
    onTriggerShortcut,
    onManageShortcuts,
    onOpenTools,
    searchMode,
    ttsMode,
    onToggleTtsMode,
    placeholder,
    bottomTrailing,
    footer,
    sendIconSize,
    minRows
  }
}
