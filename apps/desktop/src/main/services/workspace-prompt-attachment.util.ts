import path from 'node:path'
import { stripAttachmentBinaryForStorage } from '@baishou/shared'

export function isEphemeralAttachmentPath(filePath?: string): boolean {
  if (!filePath) return true
  return filePath.startsWith('blob:') || filePath.startsWith('data:')
}

export function classifyPromptAttachmentFlags(
  fileName: string,
  mimeType?: string
): { isImage: boolean; isPdf: boolean; isText: boolean } {
  const mime = mimeType || ''
  return {
    isImage:
      mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(fileName),
    isPdf: mime === 'application/pdf' || /\.pdf$/i.test(fileName),
    isText:
      mime === 'text/plain' ||
      mime === 'text/markdown' ||
      /\.(txt|md)$/i.test(fileName)
  }
}

export function toFileUrl(absolutePath: string): string {
  return `file:///${absolutePath.replace(/\\/g, '/')}`
}

export function workspaceRelativeFromFolder(
  folderRoot: string,
  absolutePath: string
): string | undefined {
  const root = path.resolve(folderRoot)
  const target = path.resolve(absolutePath)
  const rel = path.relative(root, target)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return undefined
  return rel.replace(/\\/g, '/')
}

function mimeTypeForFlags(
  fileName: string,
  flags: { isImage: boolean; isPdf: boolean; isText: boolean },
  mimeType?: string
): string | undefined {
  if (mimeType) return mimeType
  if (flags.isPdf) return 'application/pdf'
  if (flags.isText) return 'text/plain'
  if (flags.isImage) {
    const ext = path.extname(fileName).toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.gif') return 'image/gif'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.bmp') return 'image/bmp'
    return 'image/jpeg'
  }
  return undefined
}

export function decorateWorkspacePromptAttachment(params: {
  absolutePath: string
  fileName: string
  folderRoot?: string
  mimeType?: string
}): Record<string, unknown> {
  const flags = classifyPromptAttachmentFlags(params.fileName, params.mimeType)
  const relativePath = params.folderRoot
    ? workspaceRelativeFromFolder(params.folderRoot, params.absolutePath)
    : undefined
  const fileUrl = toFileUrl(params.absolutePath)
  return stripAttachmentBinaryForStorage({
    filePath: params.absolutePath,
    fileName: params.fileName,
    name: params.fileName,
    url: fileUrl,
    uri: fileUrl,
    ...(relativePath ? { relativePath } : {}),
    isImage: flags.isImage,
    isPdf: flags.isPdf,
    isText: flags.isText,
    type: flags.isImage ? 'image' : 'file',
    mimeType: mimeTypeForFlags(params.fileName, flags, params.mimeType)
  })
}

export function isWorkspacePromptImage(att: {
  fileName?: string
  name?: string
  filePath?: string
  mimeType?: string
  isImage?: boolean
}): boolean {
  if (att.isImage === true) return true
  const fileName = att.fileName || att.name || (att.filePath ? path.basename(att.filePath) : '')
  return classifyPromptAttachmentFlags(fileName, att.mimeType).isImage
}

export function planWorkspacePromptAttachment(att: {
  data?: string
  filePath?: string
  fileName?: string
  name?: string
  mimeType?: string
  isImage?: boolean
}):
  | { mode: 'ephemeral' }
  | { mode: 'image-snapshot'; absolutePath: string; fileName: string }
  | { mode: 'path-ref'; absolutePath: string; fileName: string }
  | { mode: 'unresolved' } {
  if (att.data && isEphemeralAttachmentPath(att.filePath)) {
    return { mode: 'ephemeral' }
  }
  if (att.filePath && !isEphemeralAttachmentPath(att.filePath)) {
    const fileName = att.fileName || att.name || path.basename(att.filePath)
    if (isWorkspacePromptImage({ ...att, fileName })) {
      return { mode: 'image-snapshot', absolutePath: att.filePath, fileName }
    }
    return { mode: 'path-ref', absolutePath: att.filePath, fileName }
  }
  return { mode: 'unresolved' }
}
