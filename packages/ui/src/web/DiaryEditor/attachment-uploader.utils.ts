import type { DiaryAttachmentItem } from './attachment-uploader.types'

export function getInsertMarkdown(attachment: DiaryAttachmentItem): string {
  if (attachment.isImage) {
    return `![${attachment.fileName}](attachment/${attachment.fileName})`
  }
  if (attachment.isVideo) {
    return `<video src="attachment/${attachment.fileName}" controls></video>`
  }
  if (attachment.isAudio) {
    return `<audio src="attachment/${attachment.fileName}" controls></audio>`
  }
  return `[📎 ${attachment.fileName}](attachment/${attachment.fileName})`
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function mapUploadResultToAttachment(r: {
  fileName: string
  filePath: string
  relativePath: string
}): DiaryAttachmentItem {
  return {
    id: Math.random().toString(36).substring(7),
    fileName: r.fileName,
    filePath: r.filePath,
    relativePath: r.relativePath,
    isImage: /\.(png|jpe?g|gif|webp|bmp)$/i.test(r.fileName),
    isVideo: /\.(mp4|webm|ogg|mov)$/i.test(r.fileName),
    isAudio: /\.(mp3|wav|ogg|aac)$/i.test(r.fileName)
  }
}
