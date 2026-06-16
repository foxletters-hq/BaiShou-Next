import { nativeImage } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
  AVATAR_IMPORT_JPEG_QUALITY_DESKTOP,
  AVATAR_IMPORT_MAX_DIMENSION,
  shouldCompressAvatarFileSize
} from '@baishou/shared'

function resizeNativeImage(image: Electron.NativeImage): Electron.NativeImage {
  const size = image.getSize()
  if (size.width <= AVATAR_IMPORT_MAX_DIMENSION && size.height <= AVATAR_IMPORT_MAX_DIMENSION) {
    return image
  }
  const ratio = Math.min(
    AVATAR_IMPORT_MAX_DIMENSION / size.width,
    AVATAR_IMPORT_MAX_DIMENSION / size.height
  )
  return image.resize({
    width: Math.round(size.width * ratio),
    height: Math.round(size.height * ratio)
  })
}

function nativeImageToJpegDataUrl(image: Electron.NativeImage): string {
  const resized = resizeNativeImage(image)
  return `data:image/jpeg;base64,${resized.toJPEG(AVATAR_IMPORT_JPEG_QUALITY_DESKTOP).toString('base64')}`
}

/** 大图落盘前压缩；小图原样返回路径 */
export async function compressAvatarFileIfNeeded(sourcePath: string): Promise<string> {
  const stat = await fs.stat(sourcePath)
  if (!shouldCompressAvatarFileSize(stat.size)) {
    return sourcePath
  }

  const image = nativeImage.createFromPath(sourcePath)
  if (image.isEmpty()) {
    return sourcePath
  }

  const outPath = path.join(os.tmpdir(), `baishou-avatar-${Date.now()}.jpg`)
  const resized = resizeNativeImage(image)
  await fs.writeFile(outPath, resized.toJPEG(AVATAR_IMPORT_JPEG_QUALITY_DESKTOP))
  return outPath
}

/** data URL 超过体积阈值时转 JPEG 并适度缩放 */
export function compressAvatarDataUrlIfNeeded(dataUrl: string): string {
  const matches = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/s)
  if (!matches?.[2]) return dataUrl

  const byteSize = Buffer.byteLength(matches[2], 'base64')
  if (!shouldCompressAvatarFileSize(byteSize)) {
    return dataUrl
  }

  try {
    const image = nativeImage.createFromBuffer(Buffer.from(matches[2], 'base64'))
    if (image.isEmpty()) return dataUrl
    return nativeImageToJpegDataUrl(image)
  } catch {
    return dataUrl
  }
}

/** importAvatar 前统一预处理（文件路径 / data URL） */
export async function prepareAvatarSourceForImport(source: string): Promise<string> {
  if (!source || source.startsWith('avatars/')) {
    return source
  }
  if (source.startsWith('data:image/')) {
    return compressAvatarDataUrlIfNeeded(source)
  }
  if (source.startsWith('local://')) {
    try {
      const { fileURLToPath } = await import('node:url')
      const fileUrlNode = source.replace(/^local:/i, 'file:')
      return compressAvatarFileIfNeeded(fileURLToPath(fileUrlNode))
    } catch {
      return source
    }
  }
  if (path.isAbsolute(source) || /^[A-Za-z]:[\\/]/.test(source)) {
    return compressAvatarFileIfNeeded(path.resolve(source))
  }
  return source
}
