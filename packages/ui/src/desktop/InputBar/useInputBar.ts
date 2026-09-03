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
  buildSkillSendText,
  composerExtraPlain,
  fileContextItemKey,
  isSafeWorkspaceRelativePath,
  getCreateSkillGuidePrompt,
  getDefaultShortcutLabelsFromT,
  getShortcutCommand,
  localizePromptShortcuts,
  parseFileMentionToken,
  type MockChatAttachment,
  type PromptFileRef,
  type PromptShortcut,
  type SkillInvokeRef
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useComposerDraft } from '../../shared/composer-draft'
import type { SkillComposerSnapshot } from './InputBarSkillEditor'
import {
  clearComposer,
  createSkillChipElement,
  insertFileRefChipAtSelection,
  insertSkillChipAtSelection,
  makeFileRefChipId,
  makeSkillChipId,
  serializeSkillComposer,
  setComposerPlainText,
  type FileRefChip,
  type MentionToken,
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
    setFileRefs: (v: FileRefChip[]) => void
    setSendTextCache: (v: string) => void
    htmlSnapshotRef: React.MutableRefObject<string>
  }
) {
  const snap = serializeSkillComposer(root)
  setters.setText(snap.plainText)
  setters.setSkillRefs(snap.skills)
  setters.setFileRefs(snap.fileRefs)
  setters.setSendTextCache(snap.sendText)
  setters.htmlSnapshotRef.current = root.innerHTML
  return snap
}

function toSendFileRefs(refs: FileRefChip[]): PromptFileRef[] {
  return refs
    .map((ref) => ({
      relativePath: ref.relativePath,
      selection: ref.selection,
      comment: ref.comment,
      origin: ref.origin ?? 'mention'
    }))
    .filter((ref) => Boolean(ref.relativePath))
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
    createSkillScope = 'software',
    onOpenTools,
    searchMode = true,
    onToggleSearchMode,
    ttsMode = 'manual',
    onToggleTtsMode,
    onOpenNotebookMount,
    placeholder,
    onEscape,
    bottomTrailing,
    footer,
    sendIconSize,
    minRows = 1,
    attachmentIntake = 'companion',
    resolveDropAttachments,
    fileMention
  } = props

  const { t, i18n } = useTranslation()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
  const [skillRefs, setSkillRefs] = useState<SkillRefChip[]>([])
  const [fileRefs, setFileRefs] = useState<FileRefChip[]>([])
  const [slashToken, setSlashToken] = useState<SlashToken | null>(null)
  const [mentionToken, setMentionToken] = useState<MentionToken | null>(null)
  const [skillPickerOpen, setSkillPickerOpen] = useState(false)
  const [mentionPickerOpen, setMentionPickerOpen] = useState(false)
  const [skillPickerIndex, setSkillPickerIndex] = useState(0)
  const [mentionPickerIndex, setMentionPickerIndex] = useState(0)
  const [mentionSearchPaths, setMentionSearchPaths] = useState<string[]>([])
  const [isSending, setIsSending] = useState(false)
  const [composerSyncKey, setComposerSyncKey] = useState(0)
  const [composerSyncHtml, setComposerSyncHtml] = useState<string | null>(null)
  const [sendTextCache, setSendTextCache] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const htmlSnapshotRef = useRef('')
  const textRef = useRef(text)
  const skillRefsRef = useRef(skillRefs)
  const slashDismissedRef = useRef(false)
  const mentionDismissedRef = useRef(false)
  textRef.current = text
  skillRefsRef.current = skillRefs

  const applyExternalText = useCallback((value: string | ((prev: string) => string)) => {
    const next = typeof value === 'function' ? value(textRef.current) : value
    setText(next)
    setComposerSyncHtml(null)
    setComposerSyncKey((k) => k + 1)
    setSkillRefs([])
    setFileRefs([])
    setSendTextCache(next.trim())
    setSlashToken(null)
    setMentionToken(null)
    setSkillPickerOpen(false)
    setMentionPickerOpen(false)
  }, [])

  const { clearDraft } = useComposerDraft({
    draftKey: composerDraftKey,
    draftStorage: composerDraftStorage,
    text,
    setText: applyExternalText,
    draftSyncSuspended: isSending
  })

  const insertFileRefChipRef = useRef<(ref: PromptFileRef, token?: MentionToken | null) => void>(
    () => undefined
  )

  const attachmentHandlers = useInputBarAttachments(setAttachments, {
    attachmentIntake,
    resolveDropAttachments,
    promoteWorkspaceTextRefs: Boolean(fileMention?.enabled),
    onPromotedFileRefs: (refs) => {
      for (const ref of refs) insertFileRefChipRef.current(ref, null)
    }
  })
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
    setFileRefs(snap.fileRefs)
    setSendTextCache(snap.sendText)
    htmlSnapshotRef.current = snap.html
    setSlashToken(snap.slashToken)
    setMentionToken(snap.mentionToken)
    if (!snap.slashToken) {
      slashDismissedRef.current = false
      setSkillPickerOpen(false)
      setSkillPickerIndex(0)
    } else if (!slashDismissedRef.current) {
      setSkillPickerOpen(true)
    }
    if (!fileMention?.enabled || !snap.mentionToken) {
      mentionDismissedRef.current = false
      setMentionPickerOpen(false)
      setMentionPickerIndex(0)
      return
    }
    if (!mentionDismissedRef.current) {
      setMentionPickerOpen(true)
    }
  }, [fileMention?.enabled])

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
    syncEditorState(root, { setText, setSkillRefs, setFileRefs, setSendTextCache, htmlSnapshotRef })
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

  const insertFileRefChip = useCallback(
    (ref: PromptFileRef, token?: MentionToken | null) => {
      const relativePath = ref.relativePath.trim().replace(/\\/g, '/')
      if (!relativePath || !isSafeWorkspaceRelativePath(relativePath)) return
      const root = editorRef.current
      if (!root) return
      const nextRef: PromptFileRef = {
        relativePath,
        selection: ref.selection,
        comment: ref.comment?.trim() || undefined,
        origin: ref.origin ?? 'mention'
      }
      const key = fileContextItemKey(nextRef)
      const existing = serializeSkillComposer(root).fileRefs
      if (existing.some((chip) => fileContextItemKey(chip) === key)) {
        mentionDismissedRef.current = false
        setMentionToken(null)
        setMentionPickerOpen(false)
        root.focus()
        return
      }
      const chip: FileRefChip = {
        id: makeFileRefChipId(relativePath),
        ...nextRef
      }
      insertFileRefChipAtSelection(
        root,
        chip,
        styles.skillRefChip,
        styles.skillRefText,
        token === undefined ? mentionToken : token
      )
      syncEditorState(root, { setText, setSkillRefs, setFileRefs, setSendTextCache, htmlSnapshotRef })
      mentionDismissedRef.current = false
      setMentionToken(null)
      setMentionPickerOpen(false)
      root.focus()
    },
    [mentionToken]
  )
  insertFileRefChipRef.current = insertFileRefChip

  const addFileContext = useCallback(
    (ref: PromptFileRef & { filePath?: string }) => {
      insertFileRefChip(
        {
          relativePath: ref.relativePath,
          selection: ref.selection,
          comment: ref.comment,
          origin: ref.origin ?? 'selection'
        },
        null
      )
    },
    [insertFileRefChip]
  )

  const sendComposer = useCallback(
    async (overrideSkills?: SkillInvokeRef[]) => {
      const root = editorRef.current
      const snap = root
        ? serializeSkillComposer(root)
        : { plainText: text, skills: skillRefs, fileRefs, sendText: sendTextCache }
      const pendingSkills: SkillRefChip[] = (
        overrideSkills?.length ? overrideSkills : snap.skills
      ).map((item, index) => ({
        id:
          'id' in item && typeof item.id === 'string' && item.id
            ? item.id
            : makeSkillChipId(item.command || `skill-${index}`),
        command: item.command,
        content: item.content
      }))
      const pendingPlain = snap.plainText
      const extraPlain = composerExtraPlain(pendingPlain, pendingSkills, snap.fileRefs)
      const pendingText = buildSkillSendText(
        pendingSkills.map((item) => ({ command: item.command, content: item.content })),
        extraPlain
      )
      const pendingFileRefs = toSendFileRefs(snap.fileRefs)
      const hasPayload = Boolean(
        pendingText || attachments.length > 0 || pendingFileRefs.length > 0
      )
      if (!hasPayload || isSending) return
      if (isLoading && !allowSendWhileLoading) return
      if (composerBlocked) {
        onComposerBlocked?.()
        return
      }

      const pendingAttachments = attachments.length > 0 ? [...attachments] : []
      const pendingHtml = htmlSnapshotRef.current
      const hadSearchMode = searchMode

      if (root) clearComposer(root)
      setText('')
      setAttachments([])
      setSkillRefs([])
      setFileRefs([])
      setSendTextCache('')
      setSlashToken(null)
      setMentionToken(null)
      setSkillPickerOpen(false)
      setMentionPickerOpen(false)
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
            pendingSkills.length > 0 || pendingFileRefs.length > 0
              ? {
                  displayText: pendingPlain.trim() || pendingText,
                  skillRefs:
                    pendingSkills.length > 0
                      ? pendingSkills.map((item) => ({
                          command: item.command,
                          content: item.content
                        }))
                      : undefined,
                  fileRefs: pendingFileRefs.length > 0 ? pendingFileRefs : undefined
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
          setFileRefs(snap.fileRefs)
        } else {
          await clearDraft()
        }
      } finally {
        setIsSending(false)
      }
    },
    [
      allowSendWhileLoading,
      attachments,
      clearDraft,
      composerBlocked,
      isLoading,
      isSending,
      onComposerBlocked,
      onSend,
      searchMode,
      sendTextCache,
      fileRefs,
      skillRefs,
      text
    ]
  )

  const handleSend = useCallback(() => {
    void sendComposer()
  }, [sendComposer])

  const launchInsertedSkill = useCallback(
    (skills: SkillInvokeRef[]) => {
      void sendComposer(skills)
    },
    [sendComposer]
  )

  const armCreateSkillChip = useCallback(() => {
    const content = getCreateSkillGuidePrompt(
      (key, fallback) => String(t(key, fallback ?? '')),
      createSkillScope
    )
    addSkillRef(CREATE_SKILL_SLASH_COMMAND, content)
    launchInsertedSkill([{ command: CREATE_SKILL_SLASH_COMMAND, content }])
  }, [addSkillRef, createSkillScope, launchInsertedSkill, t])

  const applyShortcut = useCallback(
    (shortcut: PromptShortcut) => {
      const command = getShortcutCommand(shortcut)
      const content = shortcut.content || ''
      addSkillRef(command, content)
      launchInsertedSkill([{ command, content }])
    },
    [addSkillRef, launchInsertedSkill]
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
      syncEditorState(root, { setText, setSkillRefs, setFileRefs, setSendTextCache, htmlSnapshotRef })
    },
    setText: (nextText) => {
      applyExternalText(nextText)
      queueMicrotask(() => editorRef.current?.focus())
    },
    getDraft: () => ({
      text: textRef.current,
      skillRefs: skillRefsRef.current.map((ref) => ({
        command: ref.command,
        content: ref.content
      }))
    }),
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
    addFileContext,
    focus: () => editorRef.current?.focus()
  }))

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
    const createDesc = CREATE_SKILL_SLASH_COMMAND
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
  }, [filteredShortcuts, slashToken])

  const mentionPathQuery = useMemo(
    () => parseFileMentionToken(mentionToken?.query || '').relativePath,
    [mentionToken?.query]
  )

  useEffect(() => {
    if (!fileMention?.enabled || !mentionPickerOpen) {
      setMentionSearchPaths([])
      return
    }
    const search = fileMention.searchFiles
    if (!search || !mentionPathQuery.trim()) {
      setMentionSearchPaths([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void search(mentionPathQuery).then((paths) => {
        if (!cancelled) setMentionSearchPaths(paths)
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [fileMention, mentionPathQuery, mentionPickerOpen])

  const mentionPickerEntries = useMemo(() => {
    if (!fileMention?.enabled) return []
    const query = mentionPathQuery.toLowerCase()
    const seen = new Set<string>()
    const entries: Array<{ id: string; path: string; group: 'recent' | 'search' }> = []
    for (const path of fileMention.recentPaths ?? []) {
      const normalized = path.replace(/\\/g, '/')
      if (!normalized || seen.has(normalized)) continue
      if (query && !normalized.toLowerCase().includes(query)) continue
      seen.add(normalized)
      entries.push({ id: `recent:${normalized}`, path: normalized, group: 'recent' })
    }
    for (const path of mentionSearchPaths) {
      const normalized = path.replace(/\\/g, '/')
      if (!normalized || seen.has(normalized)) continue
      if (query && !normalized.toLowerCase().includes(query)) continue
      seen.add(normalized)
      entries.push({ id: `search:${normalized}`, path: normalized, group: 'search' })
    }
    return entries.slice(0, 20)
  }, [fileMention, mentionPathQuery, mentionSearchPaths])

  useEffect(() => {
    setSkillPickerIndex(0)
  }, [slashToken?.query, slashPickerEntries.length])

  useEffect(() => {
    setMentionPickerIndex(0)
  }, [mentionToken?.query, mentionPickerEntries.length])

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

  const closeMentionPicker = useCallback(() => {
    mentionDismissedRef.current = true
    setMentionPickerOpen(false)
  }, [])

  const submitMentionPickerSelection = useCallback(() => {
    const picked = mentionPickerEntries[mentionPickerIndex]
    if (!picked) return
    const parsed = parseFileMentionToken(mentionToken?.query || '')
    insertFileRefChip(
      {
        relativePath: picked.path,
        selection: parsed.selection,
        origin: 'mention'
      },
      mentionToken
    )
  }, [insertFileRefChip, mentionPickerEntries, mentionPickerIndex, mentionToken])

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
    if (mentionPickerOpen) {
      if (e.key === 'Escape') {
        e.preventDefault()
        mentionDismissedRef.current = true
        setMentionPickerOpen(false)
        return
      }
      if (mentionPickerEntries.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setMentionPickerIndex((i) => Math.min(i + 1, mentionPickerEntries.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setMentionPickerIndex((i) => Math.max(i - 1, 0))
          return
        }
        if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
          e.preventDefault()
          submitMentionPickerSelection()
          return
        }
      }
    }
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
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      onEscape()
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
        syncEditorState(root, { setText, setSkillRefs, setFileRefs, setSendTextCache, htmlSnapshotRef })
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
    handleAttachmentDrop: attachmentHandlers.handleAttachmentDrop,
    attachmentIntake,
    handlePaste,
    onOpenFileRef: fileMention?.onOpenFile,
    skillPickerOpen,
    closeSkillPicker,
    slashQuery: slashToken?.query ?? '',
    slashPickerEntries,
    skillPickerIndex,
    setSkillPickerIndex,
    mentionPickerOpen,
    closeMentionPicker,
    mentionPickerEntries,
    mentionPickerIndex,
    setMentionPickerIndex,
    applyFileMention: (path: string) => {
      const parsed = parseFileMentionToken(mentionToken?.query || '')
      insertFileRefChip(
        {
          relativePath: path,
          selection: parsed.selection,
          origin: 'mention'
        },
        mentionToken
      )
    },
    fileRefs,
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
