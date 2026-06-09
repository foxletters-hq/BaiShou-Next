import { resolveAttachmentFilePath } from './resolve-attachment-path'
import {
  canReadLocalPath,
  readLocalFileAsBase64,
  readLocalFileAsBase64Async
} from './read-local-file'
import type { AttachmentLike } from '../agent/attachment-content.builder'

/** 限制尺寸与 base64 体积，避免 API 413 */
const MAX_DIMENSION = 1536
/** base64 字符数上限（约 1.1MB 原图） */
const MAX_BASE64_CHARS = 1_500_000
const JPEG_QUALITIES = [82, 75, 65, 55, 45, 35] as const

export type NormalizedImagePayload = {
  base64: string
  mimeType: string
}

function resolveImageMimeType(att: AttachmentLike, filePath: string): string {
  if (att.mimeType?.startsWith('image/')) return att.mimeType
  const name = String(att.name || att.fileName || filePath)
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}

function parseDataUrl(data: string): { base64: string; mimeType?: string } {
  if (!data.startsWith('data:')) return { base64: data }
  const match = data.match(/^data:([^;]+);base64,(.+)$/s)
  if (match?.[1] && match[2]) return { mimeType: match[1], base64: match[2] }
  return { base64: data.replace(/^data:[^;]*;base64,/, '') }
}

async function resizeWithElectron(filePath: string): Promise<NormalizedImagePayload | null> {
  if (!process.versions.electron) return null

  try {
    const { nativeImage } = await import('electron')
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return null

    const { width, height } = image.getSize()
    const scale = Math.min(1, MAX_DIMENSION / width, MAX_DIMENSION / height)
    const working =
      scale < 1
        ? image.resize({
            width: Math.max(1, Math.round(width * scale)),
            height: Math.max(1, Math.round(height * scale))
          })
        : image

    for (const quality of JPEG_QUALITIES) {
      const buf = working.toJPEG(quality)
      const base64 = buf.toString('base64')
      if (base64.length <= MAX_BASE64_CHARS) {
        return { base64, mimeType: 'image/jpeg' }
      }
    }

    const buf = working.toJPEG(30)
    return { base64: buf.toString('base64'), mimeType: 'image/jpeg' }
  } catch {
    return null
  }
}

function assertWithinSizeLimit(base64: string, label: string): void {
  if (base64.length > MAX_BASE64_CHARS) {
    throw new Error(
      `${label}过大（约 ${Math.round(base64.length / 1024)}KB），请换用更小的图片或支持视觉的模型`
    )
  }
}

/**
 * 将本地/内联图片规范化为可发给模型的 ImagePart 载荷（压缩后裸 base64）。
 */
export async function normalizeImageForModel(
  att: AttachmentLike
): Promise<NormalizedImagePayload | null> {
  const filePath = resolveAttachmentFilePath(att)
  if (canReadLocalPath(filePath)) {
    const resized = await resizeWithElectron(filePath)
    if (resized) return resized

    let base64 = readLocalFileAsBase64(filePath)
    if (!base64) {
      base64 = await readLocalFileAsBase64Async(filePath)
    }
    if (!base64) return null
    assertWithinSizeLimit(base64, '图片')
    return { base64, mimeType: resolveImageMimeType(att, filePath) }
  }

  if (att.data) {
    const { base64, mimeType } = parseDataUrl(att.data)
    if (!base64) return null
    assertWithinSizeLimit(base64, '图片')
    return { base64, mimeType: mimeType || att.mimeType || 'image/jpeg' }
  }

  if (att.url?.startsWith('data:')) {
    const { base64, mimeType } = parseDataUrl(att.url)
    if (!base64) return null
    assertWithinSizeLimit(base64, '图片')
    return { base64, mimeType: mimeType || att.mimeType || 'image/jpeg' }
  }

  return null
}
