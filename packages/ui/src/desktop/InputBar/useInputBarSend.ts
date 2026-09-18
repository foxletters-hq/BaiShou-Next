import { useCallback } from 'react'
import {
  CREATE_SKILL_SLASH_COMMAND,
  buildSkillSendText,
  composerExtraPlain,
  getCreateSkillGuidePrompt,
  getShortcutCommand,
  type MockChatAttachment,
  type PromptShortcut,
  type SkillInvokeRef
} from '@baishou/shared'
import {
  clearComposer,
  makeSkillChipId,
  serializeSkillComposer,
  type FileRefChip,
  type SkillRefChip
} from './skill-composer.util'
import { toSendFileRefs } from './input-bar-composer-sync.util'
import type { InputBarProps } from './input-bar.types'

export function useInputBarSend(params: {
  editorRef: React.RefObject<HTMLDivElement | null>
  text: string
  skillRefs: SkillRefChip[]
  fileRefs: FileRefChip[]
  sendTextCache: string
  attachments: MockChatAttachment[]
  isSending: boolean
  htmlSnapshotRef: React.MutableRefObject<string>
  addSkillRef: (command: string, content: string) => void
  createSkillScope: InputBarProps['createSkillScope']
  t: (key: string, fallback?: string) => string
  allowSendWhileLoading: boolean
  isLoading: boolean
  composerBlocked: boolean
  onComposerBlocked?: () => void
  onSend: InputBarProps['onSend']
  searchMode: boolean
  clearDraft: () => Promise<void>
  setText: (value: string) => void
  setAttachments: (value: MockChatAttachment[]) => void
  setSkillRefs: (value: SkillRefChip[]) => void
  setFileRefs: (value: FileRefChip[]) => void
  setSendTextCache: (value: string) => void
  setSlashToken: (value: null) => void
  setMentionToken: (value: null) => void
  setSkillPickerOpen: (value: boolean) => void
  setMentionPickerOpen: (value: boolean) => void
  setComposerSyncHtml: (value: string) => void
  setComposerSyncKey: (updater: (k: number) => number) => void
  setIsSending: (value: boolean) => void
}) {
  const {
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
    t,
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
    setSkillPickerOpen,
    setMentionPickerOpen,
    setComposerSyncHtml,
    setComposerSyncKey,
    setIsSending
  } = params

  const sendComposer = useCallback(
    async (overrideSkills?: SkillInvokeRef[]) => {
      const root = editorRef.current
      const snap = root
        ? serializeSkillComposer(root)
        : {
            plainText: text,
            skills: skillRefs,
            fileRefs,
            sendText: sendTextCache
          }
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
      editorRef,
      fileRefs,
      htmlSnapshotRef,
      isLoading,
      isSending,
      onComposerBlocked,
      onSend,
      searchMode,
      sendTextCache,
      setAttachments,
      setComposerSyncHtml,
      setComposerSyncKey,
      setFileRefs,
      setIsSending,
      setMentionPickerOpen,
      setMentionToken,
      setSendTextCache,
      setSkillPickerOpen,
      setSkillRefs,
      setSlashToken,
      setText,
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

  return {
    sendComposer,
    handleSend,
    launchInsertedSkill,
    armCreateSkillChip,
    applyShortcut
  }
}
