import type { IFileSystem } from '@baishou/core-mobile'
import { guessImageMimeType } from '@baishou/ui/native'
import { toFileUri } from '../services/android-external-fs'
import { normalizeExternalStoragePath } from './mobile-attachment-display-path.util'
import {
  ATTACHMENT_PREVIEW_MAX_BYTES,
  ATTACHMENT_THUMB_MAX_BYTES,
  type AttachmentImagePurpose
} from './mobile-attachment-image-cache'

export {
  needsDataUriForImageDisplay,
  resolveDisplayFallbackUri
} from './mobile-attachment-display-path.util'

const THUMB_RESIZE_WIDTH = 256
const PREVIEW_RESIZE_WIDTH = 2048

type ManipulatorModule = typeof import('expo-image-manipulator')

let manipulatorModule: ManipulatorModule | null | undefined

async function loadManipulator(): Promise<ManipulatorModule | null> {
  if (manipulatorModule !== undefined) return manipulatorModule
  try {
    manipulatorModule = await import('expo-image-manipulator')
    return manipulatorModule
  } catch (e) {
    manipulatorModule = null
    console.warn(
      '[AttachmentImage] expo-image-manipulator unavailable; rebuild dev APK if thumbnails fail.',
      e
    )
    return null
  }
}

async function manipulateToDataUri(
  filePath: string,
  width: number,
  compress: number
): Promise<string | null> {
  const manipulator = await loadManipulator()
  if (!manipulator) return null

  const { manipulateAsync, SaveFormat } = manipulator
  const uri = toFileUri(normalizeExternalStoragePath(filePath))

  try {
    const result = await manipulateAsync(uri, [{ resize: { width } }], {
      compress,
      format: SaveFormat.JPEG,
      base64: true
    })
    if (result.base64) {
      return `data:image/jpeg;base64,${result.base64}`
    }
  } catch (e) {
    console.warn('[AttachmentImage] resize failed:', filePath, e)
  }
  return null
}

async function readSmallFileAsDataUri(
  fileSystem: IFileSystem,
  filePath: string,
  maxBytes: number
): Promise<string | null> {
  const normalizedPath = normalizeExternalStoragePath(filePath)
  const fileName = normalizedPath.split('/').pop() || 'image.jpg'

  const stat = await fileSystem.stat(normalizedPath).catch(() => null)
  if (!stat?.isFile) return null

  const fileSize = stat.size ?? 0
  if (fileSize > maxBytes) return null

  try {
    const b64 = await fileSystem.readFile(normalizedPath, 'base64')
    if (!b64) return null
    return `data:${guessImageMimeType(fileName)};base64,${b64}`
  } catch (e) {
    console.warn('[AttachmentImage] read failed:', normalizedPath, e)
    return null
  }
}

/**
 * 将附件图片解析为 RN Image 可展示的 data: URI。
 * 小图直接读盘；大图走 expo-image-manipulator 缩放（避免 file:// 在外部存储无效）。
 */
export async function resolveAttachmentImageDataUri(
  fileSystem: IFileSystem,
  filePath: string,
  purpose: AttachmentImagePurpose
): Promise<string | null> {
  const maxBytes = purpose === 'preview' ? ATTACHMENT_PREVIEW_MAX_BYTES : ATTACHMENT_THUMB_MAX_BYTES

  const direct = await readSmallFileAsDataUri(fileSystem, filePath, maxBytes)
  if (direct) return direct

  const width = purpose === 'preview' ? PREVIEW_RESIZE_WIDTH : THUMB_RESIZE_WIDTH
  const compress = purpose === 'preview' ? 0.85 : 0.72
  return manipulateToDataUri(filePath, width, compress)
}
