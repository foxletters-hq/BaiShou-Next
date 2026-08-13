import { useState, useRef, useImperativeHandle, useMemo, useCallback, useEffect } from 'react'
import type { InputBarProps, InputBarRef } from './input-bar.types'
import { useInputBarAttachments } from './useInputBarAttachments'
import {
  INPUT_BAR_SIDE_CONTROLS_RESERVE_PX,
  INPUT_BAR_SIDE_CONTROLS_WITH_TRAILING_RESERVE_PX,
  useInputBarExpand
} from './useInputBarExpand'
import {
  CREATE_SKILL_SLASH_COMMAND,
  getCreateSkillGuidePrompt,
  getDefaultShortcutLabelsFromT,
  getShortcutCommand,
  localizePromptShortcuts,
  type MockChatAttachment,
  type PromptShortcut
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useComposerDraft } from '../../shared/composer-draft'
import type { SkillComposerSnapshot } from './InputBarSkillEditor'
import {
  clearComposer,
  createSkillChipElement,
  insertSkillChipAtSelection,
  makeSkillChipId,
  serializeSkillComposer,
  setComposerPlainText,
  type SkillRefChip,
  type SlashToken
} from './skill-composer.util'
import styles from './InputBar.module.css'

export type { SkillRefChip }

function appendPlainWithBreaks(container: HTMLElement, text: string) {
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    if (line) container.appendChild(document.createTextNode(line))
    if (index < lines.length - 1) container.appendChild(document.createElement('br'))
  })
}

function syncEditorState(
  root: HTMLElement,
  setters: {
    setText: (v: string) => void
    setSkillRefs: (v: SkillRefChip[]) => void
    setSendTextCache: (v: string) => void
    htmlSnapshotRef: React.MutableRefObject<string>
  }
) {
  const snap = serializeSkillComposer(root)
  setters.setText(snap.plainText)
  setters.setSkillRefs(snap.skills)
  setters.setSendTextCache(snap.sendText)
  setters.htmlSnapshotRef.current = root.innerHTML
  return snap
}

export function useInputBar(props: InputBarProps, ref: React.ForwardedRef<InputBarRef>) {
  const {
    isLoading,
    allowSendWhileLoading = false,
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
    onOpenNotebookMount,
    placeholder,
    bottomTrailing,
    footer,
    sendIconSize,
    minRows = 1
  } = props

  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
  const [skillRefs, setSkillRefs] = useState<SkillRefChip[]>([])
  const [slashToken, setSlashToken] = useState<SlashToken | null>(null)
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [skillPickerIndex, setSkillPickerIndex] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [composerSyncKey, setComposerSyncKey] = useState(0)
  const [composerSyncHtml, setComposerSyncHtml] = useState<string | null>(null)
  const [sendTextCache, setSendTextCache] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const htmlSnapshotRef = useRef('')
  const textRef = useRef(text)
  const slashDismissedRef = useRef(false)
  textRef.current = text

  const applyExternalText = useCallback((value: string | ((prev: string) => string)) => {
    const next = typeof value === 'function' ? value(textRef.current) : value
    setText(next)
    setComposerSyncHtml(null)
    setComposerSyncKey((k) => k + 1)
    setSkillRefs([])
    setSendTextCache(next.trim())
    setSlashToken(null)
    setSkillPickerOpen(false)
  }, [])

  const { clearDraft } = useComposerDraft({
    draftKey: composerDraftKey,
    draftStorage: composerDraftStorage,
    text,
    setText: applyExternalText,
    draftSyncSuspended: isSending
  })

  const attachmentHandlers = useInputBarAttachments(setAttachments)
  const localizedShortcuts = useMemo(() => {
    if (!shortcuts?.length) return undefined
    return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
  }, [shortcuts, t, i18n.language])

  const closeSkillPicker = useCallback(() => {
    slashDismissedRef.current = true
    setSkillPickerOpen(false)
  }, [])

  const handleComposerSnapshot = useCallback((snap: SkillComposerSnapshot) => {
    setText(snap.plainText)
    setSkillRefs(snap.skills)
    setSendTextCache(snap.sendText)
    htmlSnapshotRef.current = snap.html
    setSlashToken(snap.slashToken)
    if (!snap.slashToken) {
      slashDismissedRef.current = false
      setSkillPickerOpen(false)
      setSkillPickerIndex(0)
      return
    }
    if (!slashDismissedRef.current) {
      setSkillPickerOpen(true)
    }
  }, [])

  const insertSkillChip = useCallback((command: string, content: string, token?: SlashToken | null) => {
    const normalized = command.trim().replace(/^\//, '')
    if (!normalized) return
    const root = editorRef.current
    if (!root) return
    const chip: SkillRefChip = {
      id: makeSkillChipId(normalized),
      command: normalized,
      content
    }
    insertSkillChipAtSelection(
      root,
      chip,
      styles.skillRefChip,
      styles.skillRefText,
      token === undefined ? null : token
    )
    syncEditorState(root, { setText, setSkillRefs, setSendTextCache, htmlSnapshotRef })
    slashDismissedRef.current = false
    setSlashToken(null)
    setSkillPickerOpen(false)
    root.focus()
  }, [])

  const addSkillRef = useCallback(
    (command: string, content: string) => {
      insertSkillChip(command, content, slashToken)
    },
    [insertSkillChip, slashToken]
  )

  const armCreateSkillChip = useCallback(() => {
    addSkillRef(CREATE_SKILL_SLASH_COMMAND, getCreateSkillGuidePrompt(t))
  }, [addSkillRef, t])

  const applyShortcut = useCallback(
    (shortcut: PromptShortcut) => {
      const command = getShortcutCommand(shortcut)
      addSkillRef(command, shortcut.content || '')
    },
    [addSkillRef]
  )

  useImperativeHandle(ref, () => ({
    insertText: (newText) => {
      const root = editorRef.current
      if (!root) {
        applyExternalText((prev) => (prev ? `${prev}\n${newText}` : newText))
        return
      }
      root.focus()
      const sel = window.getSelection()
      if (sel && sel.rangeCount && root.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0)
        range.deleteContents()
        range.insertNode(document.createTextNode(newText))
        range.collapse(false)
      } else {
        setComposerPlainText(root, root.textContent ? `${root.textContent}\n${newText}` : newText)
      }
      syncEditorState(root, { setText, setSkillRefs, setSendTextCache, htmlSnapshotRef })
    },
    setText: (nextText) => {
      applyExternalText(nextText)
      queueMicrotask(() => editorRef.current?.focus())
    },
    restoreDraft: (draft) => {
      const plain = typeof draft.text === 'string' ? draft.text : ''
      const refs = (draft.skillRefs ?? [])
        .map((ref) => ({
          command: String(ref.command ?? '')
            .trim()
            .replace(/^\//, ''),
          content: typeof ref.content === 'string' ? ref.content : ''
        }))
        .filter((ref) => Boolean(ref.command))

      if (refs.length === 0) {
        applyExternalText(plain)
        queueMicrotask(() => editorRef.current?.focus())
        return
      }

      const container = document.createElement('div')
      let remaining = plain
      for (const ref of refs) {
        const label = `/${ref.command}`
        const idx = remaining.indexOf(label)
        if (idx < 0) continue
        if (idx > 0) {
          appendPlainWithBreaks(container, remaining.slice(0, idx))
        }
        container.appendChild(
          createSkillChipElement(
            {
              id: makeSkillChipId(ref.command),
              command: ref.command,
              content: ref.content
            },
            styles.skillRefChip,
            styles.skillRefText
          )
        )
        remaining = remaining.slice(idx + label.length)
      }
      if (remaining) appendPlainWithBreaks(container, remaining)

      setComposerSyncHtml(container.innerHTML)
      setComposerSyncKey((k) => k + 1)
      setSlashToken(null)
      setSkillPickerOpen(false)
      queueMicrotask(() => editorRef.current?.focus())
    },
    insertShortcutContent: (content) => {
      addSkillRef(`skill-${Date.now().toString(36)}`, content)
    },
    applySkillRef: (skill) => {
      const command =
        skill.command?.trim() ||
        skill.name?.trim() ||
        skill.id?.trim() ||
        `skill-${Date.now().toString(36)}`
      addSkillRef(command, skill.content || '')
    },
    focus: () => editorRef.current?.focus()
  }))

  const handleSend = async () => {
    const pendingText =
      sendTextCache.trim() ||
      [...skillRefs.map((c) => c.content.trim()).filter(Boolean), text.trim()]
        .filter(Boolean)
        .join('\n\n')
    const hasPayload = Boolean(pendingText || attachments.length > 0)
    if (!hasPayload || isSending) return
    if (isLoading && !allowSendWhileLoading) return
    if (composerBlocked) {
      onComposerBlocked?.()
      return
    }

    const pendingAttachments = attachments.length > 0 ? [...attachments] : []
    const pendingHtml = htmlSnapshotRef.current
    const pendingPlain = text
    const pendingSkills = skillRefs
    const hadSearchMode = searchMode

    if (editorRef.current) clearComposer(editorRef.current)
    setText('')
    setAttachments([])
    setSkillRefs([])
    setSendTextCache('')
    setSlashToken(null)
    setSkillPickerOpen(false)
    htmlSnapshotRef.current = ''
    setComposerSyncHtml('')
    setComposerSyncKey((k) => k + 1)

    setIsSending(true)
    try {
      const accepted = await Promise.resolve(
        onSend(
          pendingText,
          pendingAttachments.length > 0 ? pendingAttachments : undefined,
          hadSearchMode,
          pendingSkills.length > 0 || pendingPlain.trim() !== pendingText.trim()
            ? {
                displayText: pendingPlain.trim() || pendingText,
                skillRefs: pendingSkills.map((s) => ({
                  command: s.command,
                  content: s.content
                }))
              }
            : undefined
        )
      )
      if (accepted === false) {
        setComposerSyncHtml(pendingHtml)
        setComposerSyncKey((k) => k + 1)
        setText(pendingPlain)
        setAttachments(pendingAttachments)
        setSkillRefs(pendingSkills)
      } else {
        await clearDraft()
      }
    } finally {
      setIsSending(false)
    }
  }

  const filteredShortcuts = useMemo(() => {
    const list = localizedShortcuts ?? []
    const q = (slashToken?.query || '').trim().toLowerCase()
    if (!q) return list
    return list.filter((shortcut) => {
      const command = getShortcutCommand(shortcut).toLowerCase()
      const name = (shortcut.name || shortcut.tag || '').toLowerCase()
      const description = (shortcut.description || '').toLowerCase()
      return command.includes(q) || name.includes(q) || description.includes(q)
    })
  }, [localizedShortcuts, slashToken])

  const slashPickerEntries = useMemo(() => {
    const q = (slashToken?.query || '').trim().toLowerCase()
    const createName = CREATE_SKILL_SLASH_COMMAND
    const createDesc = t('shortcut.create_skill_desc', '创建可复用的 Agent Skill')
    const entries: Array<{
      id: string
      name: string
      description: string
      kind: 'create' | 'skill'
      skill?: PromptShortcut
    }> = []

    const createMatches =
      !q || createName.includes(q) || createDesc.toLowerCase().includes(q) || 'create skill'.includes(q)
    if (createMatches) {
      entries.push({
        id: '__create-skill__',
        name: createName,
        description: createDesc,
        kind: 'create'
      })
    }

    for (const skill of filteredShortcuts) {
      const command = getShortcutCommand(skill)
      if (command === CREATE_SKILL_SLASH_COMMAND) continue
      entries.push({
        id: skill.id,
        name: command,
        description: (skill.description || skill.name || '').trim(),
        kind: 'skill',
        skill
      })
    }
    return entries
  }, [filteredShortcuts, slashToken, t])

  useEffect(() => {
    setSkillPickerIndex(0)
  }, [slashToken?.query, slashPickerEntries.length])

  useEffect(() => {
    if (skillPickerIndex > 0 && skillPickerIndex >= slashPickerEntries.length) {
      setSkillPickerIndex(Math.max(0, slashPickerEntries.length - 1))
    }
  }, [slashPickerEntries.length, skillPickerIndex])

  const handlePromptShortcut = () => {
    if (onManageShortcuts) onManageShortcuts()
    else if (onTriggerShortcut) onTriggerShortcut()
  }

  const isMultiline = useInputBarExpand(editorRef, text, minRows, {
    sideControlsReservePx: bottomTrailing
      ? INPUT_BAR_SIDE_CONTROLS_WITH_TRAILING_RESERVE_PX
      : INPUT_BAR_SIDE_CONTROLS_RESERVE_PX
  })

  const handlePaste = (e: React.ClipboardEvent) => {
    attachmentHandlers.handlePaste(e as unknown as React.ClipboardEvent<HTMLTextAreaElement>)
  }

  const submitSlashPickerSelection = useCallback(() => {
    const picked = slashPickerEntries[skillPickerIndex]
    if (!picked) return
    if (picked.kind === 'create') {
      armCreateSkillChip()
      return
    }
    if (picked.skill) applyShortcut(picked.skill)
  }, [slashPickerEntries, skillPickerIndex, armCreateSkillChip, applyShortcut])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (skillPickerOpen && slashPickerEntries.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault()
        slashDismissedRef.current = true
        setSkillPickerOpen(false)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSkillPickerIndex((i) => Math.min(i + 1, slashPickerEntries.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSkillPickerIndex((i) => Math.max(i - 1, 0))
        return
      }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
        e.preventDefault()
        submitSlashPickerSelection()
        return
      }
    }
    if (skillPickerOpen && e.key === 'Escape') {
      e.preventDefault()
      slashDismissedRef.current = true
      setSkillPickerOpen(false)
      return
    }
    // IME 组字中的 Enter 交给浏览器确认候选，不发送 / 不拦截
    if (e.nativeEvent.isComposing || e.keyCode === 229) return

    if (e.key === 'Enter' && e.shiftKey) {
      // 与伙伴页一致：Shift+Enter 显式插入换行，避免 contenteditable 插入块级 div
      e.preventDefault()
      document.execCommand('insertLineBreak')
      const root = editorRef.current
      if (root) {
        syncEditorState(root, { setText, setSkillRefs, setSendTextCache, htmlSnapshotRef })
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return {
    t,
    text,
    setText,
    attachments,
    setAttachments,
    skillRefs,
    addSkillRef,
    armCreateSkillChip,
    editorRef,
    composerSyncKey,
    composerSyncHtml,
    handleComposerSnapshot,
    handleSend,
    handleKeyDown,
    fileInputRef: attachmentHandlers.fileInputRef,
    handlePickFiles: attachmentHandlers.handlePickFiles,
    handleNativeWebFileChange: attachmentHandlers.handleNativeWebFileChange,
    handlePaste,
    skillPickerOpen,
    closeSkillPicker,
    slashQuery: slashToken?.query ?? '',
    slashPickerEntries,
    skillPickerIndex,
    setSkillPickerIndex,
    filteredShortcuts,
    applyShortcut,
    toggleSearchMode: () => onToggleSearchMode?.(),
    handlePromptShortcut,
    localizedShortcuts: localizedShortcuts ?? [],
    isLoading,
    allowSendWhileLoading,
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
    onOpenNotebookMount,
    placeholder,
    bottomTrailing,
    footer,
    sendIconSize,
    minRows,
    isMultiline
  }
}
