import { analyzePageTexts, resolvePagesNeedingOcr } from '../knowledge-extract'
import { md5Hex } from '../../fs/md5'
import { getPdfPageBitmapRenderer, getVisionPageRecognizer, resolvePdfNumPages } from './adapters'
import { rememberSimplePageTexts } from './simple-page-cache'
import { chunkItems, clampOcrConcurrency, runPool, yieldEventLoop } from './pool.util'
import type { ExtractEngine, ExtractEngineContext, EngineExtractResult } from './types'

/** PDF 默认整份交给视觉模型；试抽等场景才用显式页码。 */
function resolveVisionPageNumbers(pageCount: number, explicit?: number[]): number[] {
  if (explicit?.length) {
    return resolvePagesNeedingOcr([], pageCount, explicit)
  }
  return Array.from({ length: pageCount }, (_, i) => i + 1)
}

/**
 * vision：复用已配置的多模态模型逐页识别（平台注入 recognizer）。
 * PDF 不先信文字层，整份渲染后交给视觉模型。
 * 支持 1–10 页并发：每一批先整批渲染，再并行识图。渲染仍由平台侧串行化。
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

    let existing = ctx.existingPageTexts ? [...ctx.existingPageTexts] : []
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

    const pagesToOcr = resolveVisionPageNumbers(pageCount, ctx.pageNumbers)
    if (pagesToOcr.length === 0) {
      return { ...analyzePageTexts(existing), extractEngine: 'vision', processedPages: [] }
    }

    const concurrency = clampOcrConcurrency(ctx.concurrency)
    const batches = chunkItems(pagesToOcr, concurrency)
    const merged = Array.from({ length: pageCount }, () => '')
    const processed: number[] = []
    let completed = 0
    ctx.onProgress?.({ page: 0, total: pagesToOcr.length, phase: 'recognize' })

    const renderBatch = async (pages: number[]) => {
      if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
      ctx.onProgress?.({ page: completed, total: pagesToOcr.length, phase: 'render' })
      return renderer({
        absolutePath: ctx.absolutePath,
        pageNumbers: pages,
        dpi: ctx.dpi ?? 200
      })
    }

    let pendingRender = batches[0] ? renderBatch(batches[0]) : null
    for (let i = 0; i < batches.length; i += 1) {
      const bitmaps = await pendingRender!
      pendingRender = batches[i + 1] ? renderBatch(batches[i + 1]!) : null
      if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
      const pages = bitmaps.filter((bmp) => Boolean(bmp?.pngBase64))
      await runPool(
        pages,
        concurrency,
        async (bmp) => {
          if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
          ctx.onProgress?.({ page: completed, total: pagesToOcr.length, phase: 'recognize' })
          const text = (
            await recognizer({
              pngBase64: bmp.pngBase64,
              page: bmp.page,
              providerId: ctx.visionProviderId,
              modelId: ctx.visionModelId
            })
          ).trim()
          merged[bmp.page - 1] = text
          processed.push(bmp.page)
          completed += 1
          ctx.onProgress?.({ page: completed, total: pagesToOcr.length, phase: 'recognize' })
          await yieldEventLoop()
        },
        ctx.signal
      )
    }

    if (!processed.length) {
      throw new Error('视觉 OCR：未能渲染任何页')
    }

    processed.sort((a, b) => a - b)
    if (ctx.persistCache !== false) {
      rememberSimplePageTexts(ctx.absolutePath, merged.slice(0, pageCount))
    }
    return {
      ...analyzePageTexts(merged.slice(0, pageCount)),
      extractEngine: 'vision',
      processedPages: processed
    }
  }
}
