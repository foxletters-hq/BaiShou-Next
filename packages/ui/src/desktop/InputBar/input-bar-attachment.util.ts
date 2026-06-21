import type { MockChatAttachment } from '@baishou/shared'

type ElectronFile = File & { path?: string }

export type InputBarAttachment = MockChatAttachment & {
  data?: string
  mimeType?: string
}

function isPersistablePath(filePath?: string): boolean {
  if (!filePath) return false
  return !filePath.startsWith('blob:') && !filePath.startsWith('data:')
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
  const electronPath = (file as ElectronFile).path
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  const isText = file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)
  const fileName = file.name || (isImage ? `pasted_${Date.now()}.png` : `file_${Date.now()}`)

  const id = Math.random().toString(36).substring(7)

  if (isPersistablePath(electronPath)) {
    return {
      id,
      fileName,
      filePath: electronPath,
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
