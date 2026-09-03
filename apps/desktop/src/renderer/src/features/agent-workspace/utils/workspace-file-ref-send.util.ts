import {
  classifyPromptAttachmentKind,
  fileContextItemKey,
  type MockChatAttachment,
  type PromptFileRef
} from '@baishou/shared'
import { joinWorkspaceAbsolutePath } from './workspace-composer-drop.util'

export function fileRefToWorkspaceAttachment(
  ref: PromptFileRef,
  folderRoot: string
): MockChatAttachment | null {
  const filePath = joinWorkspaceAbsolutePath(folderRoot, ref.relativePath)
  if (!filePath) return null
  const fileName = ref.relativePath.split('/').pop() || ref.relativePath
  const flags = classifyPromptAttachmentKind(fileName)
  return {
    id: `${fileContextItemKey(ref)}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    filePath,
    relativePath: ref.relativePath,
    isImage: flags.isImage,
    isPdf: flags.isPdf,
    isText: flags.isText,
    selection: ref.selection,
    comment: ref.comment,
    origin: ref.origin ?? 'mention'
  }
}

export function mergeWorkspaceFileRefsIntoAttachments(params: {
  attachments?: unknown[]
  fileRefs?: PromptFileRef[]
  folderRoot: string | null | undefined
}): unknown[] | undefined {
  const base = Array.isArray(params.attachments) ? [...params.attachments] : []
  if (!params.fileRefs?.length || !params.folderRoot) {
    return base.length > 0 ? base : undefined
  }

  const seen = new Set(
    base.map((raw) => {
      if (!raw || typeof raw !== 'object') return ''
      const att = raw as MockChatAttachment
      const relativePath = att.relativePath || att.fileName
      return fileContextItemKey({
        relativePath,
        selection: att.selection,
        comment: att.comment
      })
    })
  )

  for (const ref of params.fileRefs) {
    const path = ref.relativePath?.trim()
    if (!path) continue
    const key = fileContextItemKey(ref)
    if (seen.has(key)) continue
    const next = fileRefToWorkspaceAttachment(ref, params.folderRoot)
    if (!next) continue
    seen.add(key)
    base.push(next)
  }

  return base.length > 0 ? base : undefined
}
