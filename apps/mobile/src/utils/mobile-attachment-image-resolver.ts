import type { Action } from 'expo-image-manipulator'
import type { IFileSystem } from '@baishou/core-mobile'
import { Image } from 'react-native'
import { guessImageMimeType } from '@baishou/ui/native'
import { AVATAR_IMPORT_MAX_DIMENSION } from '@baishou/shared'

/** expo-image-manipulator JPEG 质量：0–1（仅移动端） */
const AVATAR_IMPORT_JPEG_QUALITY = 0.88
import { toFileUri, normalizeExternalStoragePath } from '../services/android-external-fs'
import { ensureAppCacheNoMediaMarker } from '../services/android-nomedia.util'
import { normalizeImportSourceUri } from '../services/mobile-uri-import'
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

function resolveImageDimensions(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    )
  })
}

function buildAvatarSquareCropActions(width: number, height: number): Action[] {
  const side = Math.min(width, height)
  if (side <= 0 || width === height) return []
  return [
    {
      crop: {
        originX: Math.floor((width - side) / 2),
        originY: Math.floor((height - side) / 2),
        width: side,
        height: side
      }
    }
  ]
}

/** 导入头像前：应用内居中裁剪 + 缩放，输出到沙盒 cache，避免系统裁剪写入相册 */
export async function compressImageForAvatarImport(
  sourceUri: string,
  _knownByteSize?: number
): Promise<string> {
  const normalizedSource = normalizeImportSourceUri(sourceUri)
  const manipulator = await loadManipulator()
  if (!manipulator) return normalizedSource

  await ensureAppCacheNoMediaMarker()

  const { manipulateAsync, SaveFormat } = manipulator
  const dimensions = await resolveImageDimensions(normalizedSource)
  const actions: Action[] = dimensions
    ? buildAvatarSquareCropActions(dimensions.width, dimensions.height)
    : []
  actions.push({ resize: { width: AVATAR_IMPORT_MAX_DIMENSION } })

  try {
    const result = await manipulateAsync(normalizedSource, actions, {
      compress: AVATAR_IMPORT_JPEG_QUALITY,
      format: SaveFormat.JPEG
    })
    return result.uri
  } catch (e) {
    console.warn('[AttachmentImage] avatar import prepare failed, using original:', e)
    return normalizedSource
  }
}
