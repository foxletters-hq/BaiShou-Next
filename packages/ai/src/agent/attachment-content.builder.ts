import { isVisionModel, supportsNativePdf } from '@baishou/shared'
import { resolveAttachmentFilePath } from '../platform/resolve-attachment-path'
import {
  canReadLocalPath,
  readLocalFileAsBase64,
  readLocalFileAsBase64Async,
  readPdfTextFromPath
} from '../platform/read-local-file'
import { normalizeImageForModel } from '../platform/normalize-image-for-model'

export type AttachmentLike = {
  type?: string
  name?: string
  fileName?: string
  url?: string
  data?: string
  mimeType?: string
  filePath?: string
  isText?: boolean
  isImage?: boolean
  isPdf?: boolean
  textContent?: string
}

export function inferAttachmentFlags(att: AttachmentLike): {
  isImage: boolean
  isPdf: boolean
  isText: boolean
} {
  const fileName = String(att.name || att.fileName || '')
  return {
    isImage:
      att.isImage === true ||
      att.type === 'image' ||
      /\.(png|jpe?g|gif|webp|bmp|heic)$/i.test(fileName),
    isPdf: att.isPdf === true || att.mimeType === 'application/pdf' || /\.pdf$/i.test(fileName),
    isText: att.isText === true || att.type === 'text' || /\.(txt|md)$/i.test(fileName)
  }
}

function imagePlaceholderText(att: AttachmentLike): string {
  const name = att.name || att.fileName || '图片'
  return `\n[图片附件: ${name}]`
}

/**
 * 将图片附件追加为 AI SDK ImagePart（压缩后裸 base64 + mediaType）。
 * 非视觉模型仅写入文本占位，避免把大图塞进请求体导致 413。
 */
export async function appendImagePartToContentParts(
  contentParts: unknown[],
  att: AttachmentLike,
  opts: { modelId?: string } = {}
): Promise<void> {
  const modelId = opts.modelId || ''
  const displayName = att.name || att.fileName || '图片'

  if (!isVisionModel(modelId)) {
    contentParts.push({
      type: 'text',
      text: `${imagePlaceholderText(att)}\n（当前模型「${modelId}」不支持识图，请更换视觉模型后再发送图片）`
    })
    return
  }

  const normalized = await normalizeImageForModel(att)
  if (normalized) {
    contentParts.push({
      type: 'image',
      image: normalized.base64,
      mediaType: normalized.mimeType
    })
    return
  }

  if (att.url?.startsWith('http://') || att.url?.startsWith('https://')) {
    contentParts.push({ type: 'image', image: att.url })
    return
  }

  contentParts.push({
    type: 'text',
    text: `${imagePlaceholderText(att)}\n（图片未能读取：${displayName}）`
  })
}

/**
 * 将非图片附件（PDF / 文本文件）追加为 content part。
 */
export async function appendFileAttachmentToContentParts(
  contentParts: unknown[],
  att: AttachmentLike,
  opts: { modelId?: string; providerType?: string }
): Promise<void> {
  const flags = inferAttachmentFlags(att)
  const displayName = att.name || att.fileName || 'Attachment'

  if (flags.isImage) {
    await appendImagePartToContentParts(contentParts, att, { modelId: opts.modelId })
    return
  }

  if (flags.isText || att.textContent) {
    const textContent = att.textContent || ''
    contentParts.push({
      type: 'text',
      text: `\n\n[User Uploaded File Attachment: ${displayName}]\n\`\`\`\n${textContent}\n\`\`\`\n`
    })
    return
  }

  if (flags.isPdf) {
    const nativePdfSupported = supportsNativePdf(opts.modelId || '', opts.providerType || '')
    if (nativePdfSupported) {
      let fileData = ''
      try {
        const filePath = resolveAttachmentFilePath(att)
        if (canReadLocalPath(filePath)) {
          fileData = readLocalFileAsBase64(filePath) || (await readLocalFileAsBase64Async(filePath))
        }
      } catch {
        // fallback below
      }

      contentParts.push({
        type: 'file',
        mediaType: 'application/pdf',
        data: fileData || att.data || ''
      })
      return
    }

    let textContent = att.textContent || ''
    if (!textContent) {
      try {
        const filePath = resolveAttachmentFilePath(att)
        if (canReadLocalPath(filePath)) {
          textContent = await readPdfTextFromPath(filePath)
          att.textContent = textContent
        }
      } catch {
        // keep empty
      }
    }

    contentParts.push({
      type: 'text',
      text: `\n\n[User Uploaded File Attachment: ${displayName}]\n\`\`\`\n${textContent}\n\`\`\`\n`
    })
  }
}

/** @deprecated 使用 appendImagePartToContentParts / appendFileAttachmentToContentParts */
export async function appendAttachmentToContentParts(
  contentParts: unknown[],
  att: AttachmentLike,
  opts: { modelId?: string; providerType?: string }
): Promise<void> {
  await appendFileAttachmentToContentParts(contentParts, att, opts)
}

export function finalizeUserContentParts(contentParts: any[]): string | any[] {
  if (contentParts.length === 1) {
    const only = contentParts[0] as { type?: string; text?: string }
    if (only?.type === 'text' && typeof only.text === 'string') {
      return only.text
    }
  }
  if (contentParts.length === 0) {
    return ''
  }
  return contentParts
}

/** 当前消息是否包含图片附件（用于发送前校验） */
export function messageHasImageAttachments(
  attachments?: readonly AttachmentLike[] | null
): boolean {
  return Boolean(attachments?.some((att) => inferAttachmentFlags(att).isImage))
}
