import { analyzePageTexts, extractPdfPageTexts, MIN_TEXT_LAYER_CHARS } from '../knowledge-extract'
import { md5Hex } from '../../fs/md5'
import { getPdfPageBitmapRenderer, probeTesseractJs, resolvePdfNumPages } from './adapters'
import { getRegisteredSimplePageTexts, rememberSimplePageTexts } from './simple-page-cache'
import { clampOcrConcurrency, runPool, yieldEventLoop } from './pool.util'
import type { ExtractEngine, ExtractEngineContext, EngineExtractResult } from './types'

type TesseractWorker = {
  recognize: (image: string | Buffer) => Promise<{ data: { text: string } }>
  terminate: () => Promise<void>
}

async function createTesseractWorker(lang: string): Promise<TesseractWorker> {
  const mod = (await import(/* @vite-ignore */ 'tesseract.js')) as unknown as {
    createWorker?: (langs?: string | string[]) => Promise<TesseractWorker>
    default?: { createWorker?: (langs?: string | string[]) => Promise<TesseractWorker> }
  }
  const createWorker = mod.createWorker ?? mod.default?.createWorker
  if (!createWorker) throw new Error('tesseract.js createWorker missing')

  try {
    return await createWorker(lang)
  } catch (e) {
    if (lang !== 'eng') {
      try {
        return await createWorker('eng')
      } catch {
        throw new Error(
          `OCR 语言包不可用（${lang}），且 eng 回退失败：${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
    throw e
  }
}

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
  // 若全部缺文本且 existing 为空数组长度对不上，OCR 全部页
  if (missing.length === 0 && existingPageTexts.every((t) => !t.trim())) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  return missing
}

/**
 * ocr：tesseract.js（动态 import）+ 平台注入的 PDF 位图渲染。
 * 支持 1–3 页并发；每并发槽位独立 worker，渲染由平台侧串行化。
 */
export const ocrExtractEngine: ExtractEngine = {
  id: 'ocr',
  async extract(ctx: ExtractEngineContext): Promise<EngineExtractResult> {
    const probe = await probeTesseractJs()
    if (!probe.ok) {
      throw new Error(probe.reason || 'tesseract.js unavailable')
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

    // 页数未知：用 renderer/probe 的 numPages；仍未知禁止伪造 1 页后标 ready
    const pageCount = await resolvePdfNumPages(ctx.absolutePath, existing.length)
    if (pageCount == null || pageCount <= 0) {
      return {
        text: existing.join('\n\n'),
        pages: { pages: [] },
        pageCount: 0,
        textPageCount: 0,
        quality: 'needs_ocr',
        evidence: '无法确定 PDF 页数，禁止标 ready',
        extractEngine: 'ocr',
        textHash: md5Hex(existing.join('\n\n')),
        processedPages: []
      }
    }
    while (existing.length < pageCount) existing = [...existing, '']
    if (existing.length > pageCount) existing = existing.slice(0, pageCount)

    const pagesToOcr = resolveMissingPageNumbers(existing, pageCount, ctx.pageNumbers)
    if (pagesToOcr.length === 0) {
      return { ...analyzePageTexts(existing), extractEngine: 'ocr', processedPages: [] }
    }

    const dpi = ctx.dpi ?? 250
    const lang = ctx.language || 'chi_sim+eng'
    const concurrency = clampOcrConcurrency(ctx.concurrency)

    const workers: TesseractWorker[] = []
    const merged = [...existing]
    const processed: number[] = []
    let completed = 0
    ctx.onProgress?.({ page: 0, total: pagesToOcr.length })

    try {
      for (let i = 0; i < concurrency; i++) {
        workers.push(await createTesseractWorker(lang))
      }

      await runPool(
        pagesToOcr,
        concurrency,
        async (pageNum, workerIndex) => {
          if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
          const worker = workers[workerIndex]
          if (!worker) return
          const bitmaps = await renderer({
            absolutePath: ctx.absolutePath,
            pageNumbers: [pageNum],
            dpi
          })
          if (ctx.signal?.aborted) throw new Error('knowledge-extract-cancelled')
          const bmp = bitmaps[0]
          if (!bmp) return
          const imageDataUrl = `data:image/png;base64,${bmp.pngBase64}`
          const { data } = await worker.recognize(imageDataUrl)
          const text = (data.text || '').trim()
          const idx = bmp.page - 1
          while (merged.length <= idx) merged.push('')
          merged[idx] = text
          processed.push(bmp.page)
          completed += 1
          ctx.onProgress?.({ page: completed, total: pagesToOcr.length })
          await yieldEventLoop()
        },
        ctx.signal
      )
    } finally {
      await Promise.all(
        workers.map(async (worker) => {
          try {
            await worker.terminate()
          } catch {
            /* ignore */
          }
        })
      )
    }

    processed.sort((a, b) => a - b)
    rememberSimplePageTexts(ctx.absolutePath, merged)
    return {
      ...analyzePageTexts(merged),
      extractEngine: 'ocr',
      processedPages: processed
    }
  }
}
