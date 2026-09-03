import { classifyPromptAttachmentKind, type MockChatAttachment } from '@baishou/shared'

type ElectronFile = File & { path?: string }

export type InputBarAttachment = MockChatAttachment & {
  data?: string
  mimeType?: string
}

function isPersistablePath(filePath?: string): boolean {
  if (!filePath) return false
  return !filePath.startsWith('blob:') && !filePath.startsWith('data:')
}

export function resolveDroppedFilePath(file: File): string | undefined {
  const electronPath = (file as ElectronFile).path
  if (isPersistablePath(electronPath)) return electronPath
  if (typeof window === 'undefined') return undefined
  const getter = (
    window as Window & {
      api?: { agentWorkspace?: { getPathForFile?: (next: File) => string } }
    }
  ).api?.agentWorkspace?.getPathForFile
  if (typeof getter !== 'function') return undefined
  try {
    const next = getter(file)
    return isPersistablePath(next) ? next : undefined
  } catch {
    return undefined
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export async function fileToChatAttachment(file: File): Promise<InputBarAttachment> {
  const localPath = resolveDroppedFilePath(file)
  const flags = classifyPromptAttachmentKind(file.name, file.type)
  const isImage = file.type.startsWith('image/') || flags.isImage
  const isPdf = file.type === 'application/pdf' || flags.isPdf
  const isText = flags.isText
  const fileName = file.name || (isImage ? `pasted_${Date.now()}.png` : `file_${Date.now()}`)

  const id = Math.random().toString(36).substring(7)

  if (isPersistablePath(localPath)) {
    return {
      id,
      fileName,
      filePath: localPath,
      isImage,
      isPdf,
      isText,
      fileSize: file.size,
      mimeType: file.type || undefined
    }
  }

  const previewPath = URL.createObjectURL(file)
  const needsData = isImage || isPdf
  const data = needsData ? await fileToBase64(file) : undefined

  return {
    id,
    fileName,
    filePath: previewPath,
    isImage,
    isPdf,
    isText,
    fileSize: file.size,
    data,
    mimeType: file.type || undefined
  }
}

const TEXT_FILE_SIZE_LIMIT = 512 * 1024

function isInMemoryAttachmentPath(filePath?: string): boolean {
  if (!filePath) return true
  return filePath.startsWith('blob:') || filePath.startsWith('data:')
}

/** 工作区路径引用会在物化时截断；仅拒绝没有落盘路径的超大内存文本 */
export function shouldRejectOversizedTextAttachment(att: {
  isText?: boolean
  fileSize?: number
  relativePath?: string
  filePath?: string
}): boolean {
  if (!att.isText || !att.fileSize || att.fileSize <= TEXT_FILE_SIZE_LIMIT) return false
  if (att.relativePath?.trim()) return false
  if (!isInMemoryAttachmentPath(att.filePath)) return false
  return true
}

export function collectClipboardImageFiles(clipboardData: DataTransfer): File[] {
  const files: File[] = []
  for (let i = 0; i < clipboardData.items.length; i++) {
    const item = clipboardData.items[i]
    if (!item || item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file?.type.startsWith('image/')) files.push(file)
  }
  return files
}
