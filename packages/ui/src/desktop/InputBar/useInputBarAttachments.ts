import { useCallback, useRef } from 'react'
import type { MockChatAttachment, PromptFileRef } from '@baishou/shared'
import { isSafeWorkspaceRelativePath } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import {
  collectClipboardImageFiles,
  fileToChatAttachment,
  shouldRejectOversizedTextAttachment,
  type InputBarAttachment
} from './input-bar-attachment.util'
import {
  ingestDroppedAttachments,
  type InputBarAttachmentIntake
} from './input-bar-drop.util'

function filterValidAttachments(
  attachments: InputBarAttachment[],
  onReject: (message: string) => void
): InputBarAttachment[] {
  return attachments.filter((att) => {
    if (shouldRejectOversizedTextAttachment(att)) {
      onReject('input.file_too_large')
      return false
    }
    return true
  })
}

function asWorkspaceTextRef(att: InputBarAttachment): PromptFileRef | null {
  const relativePath = att.relativePath?.trim().replace(/\\/g, '/')
  if (!relativePath || !isSafeWorkspaceRelativePath(relativePath)) return null
  if (!att.isText || att.isImage || att.isPdf) return null
  return {
    relativePath,
    selection: att.selection,
    comment: att.comment,
    origin: att.origin ?? 'explorer-drop'
  }
}

function splitPromotedAttachments(
  attachments: InputBarAttachment[],
  promote: boolean
): { kept: InputBarAttachment[]; promoted: PromptFileRef[] } {
  if (!promote) return { kept: attachments, promoted: [] }
  const kept: InputBarAttachment[] = []
  const promoted: PromptFileRef[] = []
  for (const att of attachments) {
    const ref = asWorkspaceTextRef(att)
    if (ref) promoted.push(ref)
    else kept.push(att)
  }
  return { kept, promoted }
}

export function useInputBarAttachments(
  setAttachments: React.Dispatch<React.SetStateAction<MockChatAttachment[]>>,
  options?: {
    attachmentIntake?: InputBarAttachmentIntake
    resolveDropAttachments?: (
      dataTransfer: DataTransfer
    ) => Promise<MockChatAttachment[] | null>
    promoteWorkspaceTextRefs?: boolean
    onPromotedFileRefs?: (refs: PromptFileRef[]) => void
  }
) {
  const { t } = useTranslation()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rejectOversizedText = useCallback(
    (key: string) => {
      toast.showError(t(key, '文件大小超过限制 (最大 512KB)'))
    },
    [t, toast]
  )

  const commitAttachments = useCallback(
    (attachments: InputBarAttachment[]) => {
      const { kept, promoted } = splitPromotedAttachments(
        attachments,
        Boolean(options?.promoteWorkspaceTextRefs)
      )
      if (kept.length) setAttachments((prev) => [...prev, ...kept])
      if (promoted.length) options?.onPromotedFileRefs?.(promoted)
    },
    [options?.onPromotedFileRefs, options?.promoteWorkspaceTextRefs, setAttachments]
  )

  const addAttachments = useCallback(
    async (files: File[]) => {
      if (!files.length) return
      try {
        const newAtts = await Promise.all(files.map(fileToChatAttachment))
        const valid = filterValidAttachments(newAtts, rejectOversizedText)
        if (valid.length) commitAttachments(valid)
      } catch (e) {
        console.error('Failed to add attachments:', e)
      }
    },
    [commitAttachments, rejectOversizedText]
  )

  const handlePickFiles = async () => {
    const api =
      typeof window !== 'undefined'
        ? (window as Window & { api?: { pickFiles?: () => Promise<MockChatAttachment[]> } }).api
        : undefined
    if (api?.pickFiles) {
      try {
        const newAtts = await api.pickFiles()
        if (newAtts?.length) {
          const valid = filterValidAttachments(newAtts as InputBarAttachment[], rejectOversizedText)
          if (valid.length) commitAttachments(valid)
        }
      } catch (e) {
        console.error('Failed to pick file via IPC:', e)
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleNativeWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    await addAttachments(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleAttachmentDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      try {
        const newAtts = await ingestDroppedAttachments({
          dataTransfer,
          intake: options?.attachmentIntake ?? 'companion',
          resolveDropAttachments: options?.resolveDropAttachments
            ? async (dt) => {
                const resolved = await options.resolveDropAttachments?.(dt)
                return resolved as InputBarAttachment[] | null
              }
            : undefined
        })
        const valid = filterValidAttachments(newAtts, rejectOversizedText)
        if (valid.length) commitAttachments(valid)
      } catch (e) {
        console.error('Failed to add dropped attachments:', e)
      }
    },
    [
      commitAttachments,
      options?.attachmentIntake,
      options?.resolveDropAttachments,
      rejectOversizedText
    ]
  )

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const imageFiles = collectClipboardImageFiles(e.clipboardData)
      if (imageFiles.length) {
        e.preventDefault()
        await addAttachments(imageFiles)
        return
      }

      // contenteditable 默认粘贴 HTML，会带入底色/字号；统一为纯文本
      e.preventDefault()
      const text = e.clipboardData.getData('text/plain')
      if (text) {
        document.execCommand('insertText', false, text)
      }
    },
    [addAttachments]
  )

  return {
    fileInputRef,
    handlePickFiles,
    handleNativeWebFileChange,
    handlePaste,
    handleAttachmentDrop
  }
}
