import { analyzePageTexts, extractPdfPageTexts, MIN_TEXT_LAYER_CHARS } from '../knowledge-extract'
import { md5Hex } from '../../fs/md5'
import { getPdfPageBitmapRenderer, probeTesseractJs, resolvePdfNumPages } from './adapters'
import { getRegisteredSimplePageTexts, rememberSimplePageTexts } from './simple-page-cache'
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
 * partial / needs_ocr 可只处理缺失页。
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
    const bitmaps = await renderer({
      absolutePath: ctx.absolutePath,
      pageNumbers: pagesToOcr,
      dpi
    })

    let worker: TesseractWorker | null = null
    const merged = [...existing]
    const processed: number[] = []

    try {
      worker = await createTesseractWorker(lang)
      for (let i = 0; i < bitmaps.length; i++) {
        const bmp = bitmaps[i]!
        ctx.onProgress?.({ page: i + 1, total: bitmaps.length })
        const imageDataUrl = `data:image/png;base64,${bmp.pngBase64}`
        const { data } = await worker.recognize(imageDataUrl)
        const text = (data.text || '').trim()
        const idx = bmp.page - 1
        while (merged.length <= idx) merged.push('')
        merged[idx] = text
        processed.push(bmp.page)
      }
    } finally {
      if (worker) {
        try {
          await worker.terminate()
        } catch {
          /* ignore */
        }
      }
    }

    rememberSimplePageTexts(ctx.absolutePath, merged)
    return {
      ...analyzePageTexts(merged),
      extractEngine: 'ocr',
      processedPages: processed
    }
  }
}
