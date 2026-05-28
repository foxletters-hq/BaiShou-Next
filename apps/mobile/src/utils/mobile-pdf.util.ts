import type { IFileSystem } from '@baishou/core-mobile'
import { logger } from '@baishou/shared'

let extractModule: {
  isAvailable: () => boolean
  extractText: (filePath: string, password?: string) => Promise<string>
} | null = null

async function loadExtractor() {
  if (extractModule) return extractModule
  try {
    extractModule = await import('expo-pdf-text-extract')
    return extractModule
  } catch (e) {
    logger.warn(
      '[MobilePDF] expo-pdf-text-extract not linked; PDF text fallback unavailable',
      e as Error
    )
    return null
  }
}

/** 从本地 PDF 提取文本（对齐桌面 pdf-parse 回退路径） */
export async function extractPdfText(filePath: string, fileSystem: IFileSystem): Promise<string> {
  const normalized = filePath.startsWith('file://') ? filePath : `file://${filePath}`
  const mod = await loadExtractor()
  if (mod?.isAvailable?.()) {
    try {
      const text = await mod.extractText(normalized)
      return text?.trim() || ''
    } catch (e) {
      logger.warn('[MobilePDF] native extract failed:', e as Error)
    }
  }

  // 开发构建未链接原生模块时，至少确认文件可读
  const path = normalized.replace(/^file:\/\//, '')
  if (!(await fileSystem.exists(path))) {
    throw new Error('PDF file not found')
  }
  throw new Error(
    'PDF 文本提取需要包含 expo-pdf-text-extract 的开发构建（pnpm mobile:android:clean 重编）'
  )
}

export async function isPdfTextExtractionAvailable(): Promise<boolean> {
  const mod = await loadExtractor()
  return Boolean(mod?.isAvailable?.())
}
