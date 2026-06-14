import {
  registerImageCompressor,
  type ImageCompressRequest,
  type ImageCompressResult
} from '@baishou/ai'
import { logger } from '@baishou/shared'
import { toFileUri } from './android-external-fs'
import { cacheDirectory, writeAsStringAsync, deleteAsync, EncodingType } from './mobile-sandbox-fs'

const DIMENSION_STEPS = [1536, 1280, 1024, 768, 512] as const
const QUALITY_STEPS = [0.82, 0.75, 0.65, 0.55, 0.45, 0.35, 0.28] as const

type ManipulatorModule = typeof import('expo-image-manipulator')

let manipulatorModule: ManipulatorModule | null | undefined

async function loadManipulator(): Promise<ManipulatorModule | null> {
  if (manipulatorModule !== undefined) return manipulatorModule
  try {
    manipulatorModule = await import('expo-image-manipulator')
    return manipulatorModule
  } catch (e) {
    manipulatorModule = null
    logger.warn(
      '[MobileImageCompressor] expo-image-manipulator 未链接，图片自动压缩不可用。请执行 pnpm dev:mobile:clear 重编开发版 APK。',
      e as Error
    )
    return null
  }
}

function toManipulatorUri(filePath?: string): string | null {
  if (!filePath?.trim()) return null
  if (
    filePath.startsWith('file://') ||
    filePath.startsWith('content://') ||
    filePath.startsWith('data:')
  ) {
    return filePath
  }
  return toFileUri(filePath)
}

async function withTempSourceUri(
  request: ImageCompressRequest,
  run: (uri: string, cleanup: () => Promise<void>) => Promise<ImageCompressResult | null>
): Promise<ImageCompressResult | null> {
  const directUri = toManipulatorUri(request.filePath)
  if (directUri) {
    return run(directUri, async () => {})
  }

  if (!request.base64 || !cacheDirectory) return null

  const tempUri = `${cacheDirectory}img_compress_${Date.now()}.jpg`
  try {
    await writeAsStringAsync(tempUri, request.base64, { encoding: EncodingType.Base64 })
    return await run(tempUri, () => deleteAsync(tempUri, { idempotent: true }))
  } catch {
    await deleteAsync(tempUri, { idempotent: true }).catch(() => {})
    return null
  }
}

async function tryCompressUri(
  uri: string,
  maxBase64Chars: number,
  manipulator: ManipulatorModule
): Promise<ImageCompressResult | null> {
  const { manipulateAsync, SaveFormat } = manipulator

  for (const width of DIMENSION_STEPS) {
    const resizeAction = { resize: { width } } as const
    for (const compress of QUALITY_STEPS) {
      try {
        const result = await manipulateAsync(uri, [resizeAction], {
          compress,
          format: SaveFormat.JPEG,
          base64: true
        })
        const base64 = result.base64
        if (!base64) continue
        if (base64.length <= maxBase64Chars) {
          return { base64, mimeType: 'image/jpeg' }
        }
      } catch {
        // try next quality / dimension
      }
    }
  }

  try {
    const last = await manipulateAsync(uri, [{ resize: { width: 384 } }], {
      compress: 0.22,
      format: SaveFormat.JPEG,
      base64: true
    })
    if (last.base64) {
      return { base64: last.base64, mimeType: 'image/jpeg' }
    }
  } catch {
    // ignore
  }

  return null
}

/** 向 @baishou/ai 注册移动端图片压缩（发送视觉模型前自动缩小体积） */
export function setupMobileImageCompressor(): void {
  registerImageCompressor({
    compress: async (request) => {
      const manipulator = await loadManipulator()
      if (!manipulator) return null

      return withTempSourceUri(request, async (uri, cleanup) => {
        try {
          return await tryCompressUri(uri, request.maxBase64Chars, manipulator)
        } finally {
          await cleanup()
        }
      })
    }
  })

  void loadManipulator()
}
