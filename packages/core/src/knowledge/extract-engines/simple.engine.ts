import { analyzePageTexts, extractPdfFromPath } from '../knowledge-extract'
import type { ExtractEngine, ExtractEngineContext, EngineExtractResult } from './types'

/**
 * simple：仅取 PDF 文本层（平台注入的 page extractor）。
 */
export const simpleExtractEngine: ExtractEngine = {
  id: 'simple',
  async extract(ctx: ExtractEngineContext): Promise<EngineExtractResult> {
    if (ctx.existingPageTexts?.length && !ctx.pageNumbers?.length) {
      return { ...analyzePageTexts(ctx.existingPageTexts), extractEngine: 'simple' }
    }
    const result = await extractPdfFromPath(ctx.absolutePath)
    return { ...result, extractEngine: 'simple' }
  }
}
