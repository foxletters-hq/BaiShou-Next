import { analyzePageTexts, extractPdfPageTexts, MIN_TEXT_LAYER_CHARS } from '../knowledge-extract'
import { md5Hex } from '../../fs/md5'
import { getPdfPageBitmapRenderer, getVisionPageRecognizer, resolvePdfNumPages } from './adapters'
import { getRegisteredSimplePageTexts, rememberSimplePageTexts } from './simple-page-cache'
import { clampOcrConcurrency, runPool, yieldEventLoop } from './pool.util'
import type { ExtractEngine, ExtractEngineContext, EngineExtractResult } from './types'

function resolveMissingPageNumbers(
  existingPageTexts: string[],
  pageCount: number,
  explicit?: number[]
): number[] {
  if (explicit?.length) {
    return [...new Set(explicit)].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  }
  const missing: number[] = []
  for (let i = 0; i < pageCount; i++) {
    const t = (existingPageTexts[i] ?? '').trim()
    if (t.length < MIN_TEXT_LAYER_CHARS) missing.push(i + 1)
  }
  if (missing.length === 0 && existingPageTexts.every((t) => !t.trim())) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  return missing
}

/**
 * vision：复用已配置的多模态模型逐页识别（平台注入 recognizer）。
 * 支持 1–10 页并发；渲染由平台侧串行化。
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

    const pageCount = await resolvePdfNumPages(ctx.absolutePath, existing.length)
    if (pageCount == null || pageCount <= 0) {
      return {
        text: existing.join('\n\n'),
        pages: { pages: [] },
        pageCount: 0,
        textPageCount: 0,
        quality: 'needs_ocr',
        evidence: '无法确定 PDF 页数，禁止标 ready',
        extractEngine: 'vision',
        textHash: md5Hex(existing.join('\n\n')),
        processedPages: []
      }
    }
    while (existing.length < pageCount) existing = [...existing, '']
    if (existing.length > pageCount) existing = existing.slice(0, pageCount)

    const pagesToOcr = resolveMissingPageNumbers(existing, pageCount, ctx.pageNumbers)
    if (pagesToOcr.length === 0) {
      return { ...analyzePageTexts(existing), extractEngine: 'vision', processedPages: [] }
    }

    const concurrency = clampOcrConcurrency(ctx.concurrency)
    const merged = [...existing]
    const processed: number[] = []
    let completed = 0
    ctx.onProgress?.({ page: 0, total: pagesToOcr.length })

    await runPool(
      pagesToOcr,
      concurrency,
      async (pageNum) => {
        if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
        const bitmaps = await renderer({
          absolutePath: ctx.absolutePath,
          pageNumbers: [pageNum],
          dpi: ctx.dpi ?? 200
        })
        if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
        const bmp = bitmaps[0]
        if (!bmp) return
        const text = (await recognizer({ pngBase64: bmp.pngBase64, page: bmp.page })).trim()
        while (merged.length < bmp.page) merged.push('')
        merged[bmp.page - 1] = text
        processed.push(bmp.page)
        completed += 1
        ctx.onProgress?.({ page: completed, total: pagesToOcr.length })
        await yieldEventLoop()
      },
      ctx.signal
    )

    if (!processed.length) {
      throw new Error('视觉 OCR：未能渲染任何页')
    }

    processed.sort((a, b) => a - b)
    rememberSimplePageTexts(ctx.absolutePath, merged.slice(0, pageCount))
    return {
      ...analyzePageTexts(merged.slice(0, pageCount)),
      extractEngine: 'vision',
      processedPages: processed
    }
  }
}
