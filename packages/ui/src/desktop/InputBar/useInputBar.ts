import { useState, useRef, useImperativeHandle, useMemo, useCallback } from 'react'
import type { InputBarProps, InputBarRef } from './input-bar.types'
import { useInputBarAttachments } from './useInputBarAttachments'
import {
  INPUT_BAR_SIDE_CONTROLS_RESERVE_PX,
  INPUT_BAR_SIDE_CONTROLS_WITH_TRAILING_RESERVE_PX,
  useInputBarExpand
} from './useInputBarExpand'
import {
  fileContextItemKey,
  isSafeWorkspaceRelativePath,
  getDefaultShortcutLabelsFromT,
  localizePromptShortcuts,
  parseFileMentionToken,
  type MockChatAttachment,
  type PromptFileRef,
  type PromptShortcut
} from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useComposerDraft } from '../../shared/composer-draft'
import type { SkillComposerSnapshot } from './InputBarSkillEditor'
import {
  insertFileRefChipAtSelection,
  insertSkillChipAtSelection,
  makeFileRefChipId,
  makeSkillChipId,
  serializeSkillComposer,
  type FileRefChip,
  type MentionToken,
  type SkillRefChip,
  type SlashToken
} from './skill-composer.util'
import { syncEditorState } from './input-bar-composer-sync.util'
import { useInputBarPickers } from './useInputBarPickers'
import { useInputBarSend } from './useInputBarSend'
import { createInputBarKeyDownHandler } from './useInputBarKeydown'
import { createInputBarHandle } from './useInputBarHandle'
import styles from './InputBar.module.css'

export type { SkillRefChip }

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

  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([])
  const [skillRefs, setSkillRefs] = useState<SkillRefChip[]>([])
  const [fileRefs, setFileRefs] = useState<FileRefChip[]>([])
  const [slashToken, setSlashToken] = useState<SlashToken | null>(null)
  const [mentionToken, setMentionToken] = useState<MentionToken | null>(null)
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

  const insertFileRefChipRef = useRef<(ref: PromptFileRef, token?: MentionToken | null) => void>(
    () => undefined
  )
  const armCreateSkillChipRef = useRef<() => void>(() => undefined)
  const applyShortcutRef = useRef<(shortcut: PromptShortcut) => void>(() => undefined)

  const localizedShortcuts = useMemo(() => {
    if (!shortcuts?.length) return undefined
    return localizePromptShortcuts(shortcuts, getDefaultShortcutLabelsFromT(t))
  }, [shortcuts, t])

  const pickers = useInputBarPickers({
    localizedShortcuts,
    slashToken,
    mentionToken,
    fileMention,
    insertFileRefChip: (ref, token) => insertFileRefChipRef.current(ref, token),
    armCreateSkillChip: () => armCreateSkillChipRef.current(),
    applyShortcut: (shortcut) => applyShortcutRef.current(shortcut)
  })

  const applyExternalText = useCallback(
    (value: string | ((prev: string) => string)) => {
      const next = typeof value === 'function' ? value(textRef.current) : value
      setText(next)
      setComposerSyncHtml(null)
      setComposerSyncKey((k) => k + 1)
      setSkillRefs([])
      setFileRefs([])
      setSendTextCache(next.trim())
      setSlashToken(null)
      setMentionToken(null)
      pickers.setSkillPickerOpen(false)
      pickers.setMentionPickerOpen(false)
    },
    [pickers]
  )

  const { clearDraft } = useComposerDraft({
    draftKey: composerDraftKey,
    draftStorage: composerDraftStorage,
    text,
    setText: applyExternalText,
    draftSyncSuspended: isSending
  })

  const attachmentHandlers = useInputBarAttachments(setAttachments, {
    attachmentIntake,
    resolveDropAttachments,
    promoteWorkspaceTextRefs: Boolean(fileMention?.enabled),
    onPromotedFileRefs: (refs) => {
      for (const ref of refs) insertFileRefChipRef.current(ref, null)
    }
  })

  const closeSkillPicker = useCallback(() => {
    slashDismissedRef.current = true
    pickers.closeSkillPicker()
  }, [pickers])

  const closeMentionPicker = useCallback(() => {
    mentionDismissedRef.current = true
    pickers.closeMentionPicker()
  }, [pickers])

  const handleComposerSnapshot = useCallback(
    (snap: SkillComposerSnapshot) => {
      setText(snap.plainText)
      setSkillRefs(snap.skills)
      setFileRefs(snap.fileRefs)
      setSendTextCache(snap.sendText)
      htmlSnapshotRef.current = snap.html
      setSlashToken(snap.slashToken)
      setMentionToken(snap.mentionToken)
      if (!snap.slashToken) {
        slashDismissedRef.current = false
        pickers.setSkillPickerOpen(false)
        pickers.setSkillPickerIndex(0)
      } else if (!slashDismissedRef.current) {
        pickers.setSkillPickerOpen(true)
      }
      if (!fileMention?.enabled || !snap.mentionToken) {
        mentionDismissedRef.current = false
        pickers.setMentionPickerOpen(false)
        pickers.setMentionPickerIndex(0)
        return
      }
      if (!mentionDismissedRef.current) {
        pickers.setMentionPickerOpen(true)
      }
    },
    [fileMention?.enabled, pickers]
  )

  const insertSkillChip = useCallback(
    (command: string, content: string, token?: SlashToken | null) => {
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
      syncEditorState(root, {
        setText,
        setSkillRefs,
        setFileRefs,
        setSendTextCache,
        htmlSnapshotRef
      })
      slashDismissedRef.current = false
      setSlashToken(null)
      pickers.setSkillPickerOpen(false)
      root.focus()
    },
    [pickers]
  )

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
        origin: ref.origin ?? 'mention',
        ...(ref.isDirectory ? { isDirectory: true } : {})
      }
      const key = fileContextItemKey(nextRef)
      const existing = serializeSkillComposer(root).fileRefs
      if (existing.some((chip) => fileContextItemKey(chip) === key)) {
        mentionDismissedRef.current = false
        setMentionToken(null)
        pickers.setMentionPickerOpen(false)
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
      syncEditorState(root, {
        setText,
        setSkillRefs,
        setFileRefs,
        setSendTextCache,
        htmlSnapshotRef
      })
      mentionDismissedRef.current = false
      setMentionToken(null)
      pickers.setMentionPickerOpen(false)
      root.focus()
    },
    [mentionToken, pickers]
  )
  insertFileRefChipRef.current = insertFileRefChip

  const addFileContext = useCallback(
    (ref: PromptFileRef & { filePath?: string }) => {
      insertFileRefChip(
        {
          relativePath: ref.relativePath,
          selection: ref.selection,
          comment: ref.comment,
          origin: ref.origin ?? 'selection',
          ...(ref.isDirectory ? { isDirectory: true } : {})
        },
        null
      )
    },
    [insertFileRefChip]
  )

  const { handleSend, armCreateSkillChip, applyShortcut } = useInputBarSend({
    editorRef,
    text,
    skillRefs,
    fileRefs,
    sendTextCache,
    attachments,
    isSending,
    htmlSnapshotRef,
    addSkillRef,
    createSkillScope,
    t: (key, fallback) => String(t(key, fallback ?? '')),
    allowSendWhileLoading,
    isLoading,
    composerBlocked,
    onComposerBlocked,
    onSend,
    searchMode,
    clearDraft,
    setText,
    setAttachments,
    setSkillRefs,
    setFileRefs,
    setSendTextCache,
    setSlashToken,
    setMentionToken,
    setSkillPickerOpen: pickers.setSkillPickerOpen,
    setMentionPickerOpen: pickers.setMentionPickerOpen,
    setComposerSyncHtml,
    setComposerSyncKey,
    setIsSending
  })
  armCreateSkillChipRef.current = armCreateSkillChip
  applyShortcutRef.current = applyShortcut

  useImperativeHandle(ref, () =>
    createInputBarHandle({
      editorRef,
      applyExternalText,
      setText,
      setSkillRefs,
      setFileRefs,
      setSendTextCache,
      htmlSnapshotRef,
      textRef,
      skillRefsRef,
      setComposerSyncHtml,
      setComposerSyncKey,
      setSlashToken,
      setSkillPickerOpen: pickers.setSkillPickerOpen,
      addSkillRef,
      addFileContext,
      handleAttachmentDrop: attachmentHandlers.handleAttachmentDrop
    })
  )

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

  const handleKeyDown = createInputBarKeyDownHandler({
    mentionPickerOpen: pickers.mentionPickerOpen,
    mentionPickerEntriesLength: pickers.mentionPickerEntries.length,
    mentionDismissedRef,
    setMentionPickerOpen: pickers.setMentionPickerOpen,
    setMentionPickerIndex: pickers.setMentionPickerIndex,
    submitMentionPickerSelection: pickers.submitMentionPickerSelection,
    skillPickerOpen: pickers.skillPickerOpen,
    slashPickerEntriesLength: pickers.slashPickerEntries.length,
    slashDismissedRef,
    setSkillPickerOpen: pickers.setSkillPickerOpen,
    setSkillPickerIndex: pickers.setSkillPickerIndex,
    submitSlashPickerSelection: pickers.submitSlashPickerSelection,
    onEscape,
    editorRef,
    setText,
    setSkillRefs,
    setFileRefs,
    setSendTextCache,
    htmlSnapshotRef,
    handleSend
  })

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
    skillPickerOpen: pickers.skillPickerOpen,
    closeSkillPicker,
    slashQuery: slashToken?.query ?? '',
    slashPickerEntries: pickers.slashPickerEntries,
    skillPickerIndex: pickers.skillPickerIndex,
    setSkillPickerIndex: pickers.setSkillPickerIndex,
    mentionPickerOpen: pickers.mentionPickerOpen,
    closeMentionPicker,
    mentionPickerEntries: pickers.mentionPickerEntries,
    mentionPickerIndex: pickers.mentionPickerIndex,
    setMentionPickerIndex: pickers.setMentionPickerIndex,
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
    filteredShortcuts: pickers.filteredShortcuts,
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
