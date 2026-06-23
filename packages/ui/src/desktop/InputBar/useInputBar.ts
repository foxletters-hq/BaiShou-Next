import { useState, useRef, useEffect, useImperativeHandle, useCallback, useMemo } from 'react'
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
    searchMode = false,
    onToggleSearchMode,
    ttsMode = 'manual',
    onToggleTtsMode
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
  const [showToolbar, setShowToolbar] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('baishou_toolbar_open') === 'true'
    }
    return false
  })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const toolbarViewportRef = useRef<HTMLDivElement>(null)
  const [toolbarOverflow, setToolbarOverflow] = useState(false)
  const [toolbarCanScrollLeft, setToolbarCanScrollLeft] = useState(false)
  const [toolbarCanScrollRight, setToolbarCanScrollRight] = useState(false)

  const expand = useInputBarExpand(textareaRef, text)
  const attachmentHandlers = useInputBarAttachments(setAttachments)
  const localizedShortcuts = useMemo(() => {
    if (!shortcuts?.length) return undefined
    return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
  }, [shortcuts, t, i18n.language])
  const shortcutHandlers = useInputBarShortcuts(text, setText, localizedShortcuts)

  const updateToolbarScrollState = useCallback(() => {
    const el = toolbarViewportRef.current
    if (!el) {
      setToolbarOverflow(false)
      setToolbarCanScrollLeft(false)
      setToolbarCanScrollRight(false)
      return
    }
    const { scrollLeft, scrollWidth, clientWidth } = el
    const overflow = scrollWidth - clientWidth > 4
    setToolbarOverflow(overflow)
    setToolbarCanScrollLeft(overflow && scrollLeft > 4)
    setToolbarCanScrollRight(overflow && scrollLeft < scrollWidth - clientWidth - 4)
  }, [])

  const scrollToolbar = (direction: -1 | 1) => {
    toolbarViewportRef.current?.scrollBy({ left: direction * 180, behavior: 'smooth' })
  }

  useEffect(() => {
    if (!showToolbar) return
    const sync = () => updateToolbarScrollState()
    let disposed = false
    let resizeObserver: ResizeObserver | undefined
    let viewportEl: HTMLDivElement | null = null
    const attach = () => {
      viewportEl = toolbarViewportRef.current
      if (!viewportEl || disposed) return
      sync()
      viewportEl.addEventListener('scroll', sync, { passive: true })
      resizeObserver = new ResizeObserver(sync)
      resizeObserver.observe(viewportEl)
    }
    attach()
    const retryId = window.setTimeout(attach, 240)
    return () => {
      disposed = true
      window.clearTimeout(retryId)
      if (viewportEl) viewportEl.removeEventListener('scroll', sync)
      resizeObserver?.disconnect()
    }
  }, [showToolbar, updateToolbarScrollState])

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

    setIsSending(true)
    try {
      const accepted = await Promise.resolve(
        onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined, searchMode)
      )
      if (accepted !== false) {
        setText('')
        setAttachments([])
        await clearDraft()
        if (textareaRef.current) {
          textareaRef.current.style.height = expand.isExpanded ? '100%' : 'auto'
        }
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
    showToolbar,
    setShowToolbar,
    textareaRef,
    toolbarViewportRef,
    toolbarOverflow,
    toolbarCanScrollLeft,
    toolbarCanScrollRight,
    updateToolbarScrollState,
    scrollToolbar,
    isExpanded: expand.isExpanded,
    isAnimating: expand.isAnimating,
    handleMouseDown: expand.handleMouseDown,
    toggleExpand: expand.toggleExpand,
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
    onToggleTtsMode
  }
}
