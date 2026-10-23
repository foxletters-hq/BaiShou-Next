import { isKnowledgePdfSource, pickExtractProbePages } from '@baishou/shared'
import { sliceExtractedPageTexts } from './knowledge-extract'
import { getExtractEngine, resolvePdfNumPages } from './extract-engines'
import type { ExtractEngineContext, ExtractEngineId, EngineExtractResult } from './extract-engines'

export type KnowledgeExtractProbePage = {
  page: number
  text: string
}

export type KnowledgeExtractProbeResult = {
  sourceId: string
  title: string
  engine: ExtractEngineId
  pageCount: number
  sampledPages: number[]
  pages: KnowledgeExtractProbePage[]
}

export type KnowledgeExtractProbeSource = {
  id: string
  title: string
  sourceKind?: string | null
  relativePath?: string | null
  pageCount?: number | null
}

export async function probeKnowledgeExtractSample(
  input: {
    source: KnowledgeExtractProbeSource
    absolutePath: string
    engine: ExtractEngineId
    language?: string
    dpi?: number
    concurrency?: number
    visionProviderId?: string | null
    visionModelId?: string | null
  },
  deps?: {
    extract?: (ctx: ExtractEngineContext) => Promise<EngineExtractResult>
    resolvePageCount?: (absolutePath: string, existingCount: number) => Promise<number | null>
  }
): Promise<KnowledgeExtractProbeResult> {
  const engine = input.engine
  if (engine !== 'ocr' && engine !== 'vision') {
    throw new Error('试抽取只支持本地 OCR 或视觉模型')
  }
  if (!isKnowledgePdfSource(input.source)) {
    throw new Error('试抽取只支持 PDF')
  }
  const absolutePath = String(input.absolutePath || '').trim()
  if (!absolutePath) {
    throw new Error('source file not found')
  }

  const resolvePageCount = deps?.resolvePageCount ?? resolvePdfNumPages
  const pageCount = await resolvePageCount(absolutePath, input.source.pageCount ?? 0)
  if (pageCount == null || pageCount <= 0) {
    throw new Error('无法确定 PDF 页数')
  }

  const sampledPages = pickExtractProbePages(pageCount)
  const extract =
    deps?.extract ?? ((ctx: ExtractEngineContext) => getExtractEngine(engine).extract(ctx))
  const blanks = Array.from({ length: pageCount }, () => '')
  const result = await extract({
    absolutePath,
    pageNumbers: sampledPages,
    existingPageTexts: blanks,
    language: input.language,
    dpi: input.dpi,
    concurrency: input.concurrency,
    persistCache: false,
    visionProviderId: input.visionProviderId,
    visionModelId: input.visionModelId
  })

  return {
    sourceId: input.source.id,
    title: input.source.title,
    engine,
    pageCount,
    sampledPages,
    pages: sliceExtractedPageTexts(result, sampledPages)
  }
}
