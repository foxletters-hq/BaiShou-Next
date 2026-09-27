import { logger } from '@baishou/shared'
import { markStartup } from '../startup-trace.util'

let started = false

export function resetDesktopPostWindowInitForTests(): void {
  started = false
}

/** 窗口第一次出现后再跑 PDF / 视觉识别 / MCP，避免占住首屏主线程。 */
export function scheduleDesktopPostWindowInit(start: () => Promise<void>): boolean {
  if (started) return false
  started = true
  void start().catch((error) => {
    logger.warn('[Startup] post-window init failed:', error as Error)
  })
  return true
}

export async function runDesktopPostWindowInit(): Promise<void> {
  markStartup('postWindowInit.begin')
  try {
    const { registerDesktopPdfPageExtractor } = await import('./register-desktop-pdf-extractor')
    registerDesktopPdfPageExtractor()
    const { registerDesktopPdfPageBitmapRenderer } =
      await import('./register-desktop-pdf-bitmap-renderer')
    registerDesktopPdfPageBitmapRenderer()
    const { registerDesktopVisionPageRecognizer } = await import('./register-desktop-vision-ocr')
    registerDesktopVisionPageRecognizer()
    markStartup('postWindowInit.pdfVision.registered')
  } catch (error) {
    logger.warn('[Startup] registerDesktopPdfPageExtractor failed:', error as Error)
  }

  try {
    const { bootstrapMcpServer } = await import('./mcp-runtime')
    await bootstrapMcpServer()
    markStartup('postWindowInit.mcp.ready')
  } catch (error) {
    logger.warn('[Startup] bootstrapMcpServer failed:', error as Error)
  }
}
