import { isKnowledgePdfSource, pickExtractProbePages } from '@baishou/shared'

export type KnowledgeExtractProbeSourceOption = {
  id: string
  title: string
  sourceKind?: string | null
  relativePath?: string | null
  pageCount?: number | null
}

export function listExtractProbeSources(
  sources: KnowledgeExtractProbeSourceOption[]
): KnowledgeExtractProbeSourceOption[] {
  return sources.filter((source) => isKnowledgePdfSource(source))
}

export function formatExtractProbePagesList(pageCount?: number | null): string {
  return pickExtractProbePages(Number(pageCount || 0)).join('、')
}
