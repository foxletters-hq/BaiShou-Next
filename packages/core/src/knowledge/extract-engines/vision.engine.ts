import { analyzePageTexts, extractPdfPageTexts, MIN_TEXT_LAYER_CHARS } from '../knowledge-extract'
import { getPdfPageBitmapRenderer, getVisionPageRecognizer } from './adapters'
import { getRegisteredSimplePageTexts, rememberSimplePageTexts } from './simple-page-cache'
import type { ExtractEngine, ExtractEngineContext, EngineExtractResult } from './types'

function resolveMissingPageNumbers(
  existingPageTexts: string[],
  explicit?: number[]
): number[] {
  if (explicit?.length) {
    return [...new Set(explicit)]
      .filter((p) => p >= 1 && p <= existingPageTexts.length)
      .sort((a, b) => a - b)
  }
  const missing: number[] = []
  for (let i = 0; i < existingPageTexts.length; i++) {
    const t = (existingPageTexts[i] ?? '').trim()
    if (t.length < MIN_TEXT_LAYER_CHARS) missing.push(i + 1)
  }
  if (missing.length === 0 && existingPageTexts.every((t) => !t.trim())) {
    return Array.from({ length: existingPageTexts.length }, (_, i) => i + 1)
  }
  return missing
}

/**
 * vision：复用已配置的多模态模型逐页识别（平台注入 recognizer）。
 */
export const visionExtractEngine: ExtractEngine = {
  id: 'vision',
  async extract(ctx: ExtractEngineContext): Promise<EngineExtractResult> {
    const recognizer = getVisionPageRecognizer()
    if (!recognizer) {
      throw new Error('视觉识别器未注册（需配置多模态对话模型）')
    }
    const renderer = getPdfPageBitmapRenderer()
    if (!renderer) {
      throw new Error('PDF 位图渲染器未注册（桌面需 pdfjs-dist）')
    }

    let existing =
      ctx.existingPageTexts ??
      getRegisteredSimplePageTexts(ctx.absolutePath) ??
      (await extractPdfPageTexts(ctx.absolutePath))
    rememberSimplePageTexts(ctx.absolutePath, existing)

    while (existing.length === 0) {
      // 纯扫描件可能 page extractor 返回空；渲染器会告诉总页数
      const probe = await renderer({
        absolutePath: ctx.absolutePath,
        pageNumbers: [1],
        dpi: ctx.dpi ?? 200
      })
      if (!probe.length) throw new Error('PDF 无法渲染任何页')
      // 无法预知总页数时，先只 OCR 用户指定页；否则要求至少渲染探测
      existing = ['']
      break
    }

    const pagesToOcr = resolveMissingPageNumbers(existing, ctx.pageNumbers)
    // 若 existing 只有占位，且未指定页，让渲染器渲全部（pageNumbers 省略）
    const bitmaps = await renderer({
      absolutePath: ctx.absolutePath,
      pageNumbers: pagesToOcr.length ? pagesToOcr : ctx.pageNumbers,
      dpi: ctx.dpi ?? 200
    })

    if (!bitmaps.length) {
      throw new Error('视觉 OCR：未能渲染任何页')
    }

    // 扩展 merged 长度到最大页码
    const maxPage = Math.max(...bitmaps.map((b) => b.page), existing.length)
    const merged = [...existing]
    while (merged.length < maxPage) merged.push('')

    const processed: number[] = []
    for (let i = 0; i < bitmaps.length; i++) {
      const bmp = bitmaps[i]!
      ctx.onProgress?.({ page: i + 1, total: bitmaps.length })
      const text = (await recognizer({ pngBase64: bmp.pngBase64, page: bmp.page })).trim()
      merged[bmp.page - 1] = text
      processed.push(bmp.page)
    }

    rememberSimplePageTexts(ctx.absolutePath, merged)
    return {
      ...analyzePageTexts(merged),
      extractEngine: 'vision',
      processedPages: processed
    }
  }
}
