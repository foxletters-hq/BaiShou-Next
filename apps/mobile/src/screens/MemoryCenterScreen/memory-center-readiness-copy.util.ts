import type { MemoryReadinessRow } from '@baishou/shared'

type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string

export function memoryReadinessRowLabel(id: MemoryReadinessRow['id'], t: Translate): string {
  switch (id) {
    case 'embedding':
      return t('memory.readiness_embedding', '嵌入模型')
    case 'extract':
      return t('memory.readiness_extract', '关系抽取')
    case 'vector':
      return t('memory.readiness_vector', '向量片段')
    case 'graph':
      return t('memory.readiness_graph', '关系图谱')
  }
}

export function memoryReadinessRowValue(row: MemoryReadinessRow, t: Translate): string {
  if (row.state === 'missing') return t('memory.readiness_not_configured', '未配置')
  if (row.state === 'blocked') return t('memory.readiness_need_embedding', '需要先配置嵌入模型')
  if (row.state === 'pending') {
    return t('memory.readiness_vector_pending', '未整理 {{count}} 篇', { count: row.count ?? 0 })
  }
  return row.modelId || t('memory.readiness_ready', '已就绪')
}

export function memoryReadinessRowOpensModels(id: MemoryReadinessRow['id']): boolean {
  return id === 'embedding' || id === 'extract'
}

export function memoryProviderTypeOf(
  providers: ReadonlyArray<{ id: string; type?: string }> | null | undefined,
  providerId?: string
): string | undefined {
  if (!providerId || !Array.isArray(providers)) return undefined
  return providers.find((provider) => provider.id === providerId)?.type
}

export function memoryReadinessRowById(
  rows: ReadonlyArray<MemoryReadinessRow> | null | undefined,
  id: MemoryReadinessRow['id']
): MemoryReadinessRow | undefined {
  if (!Array.isArray(rows)) return undefined
  return rows.find((row) => row.id === id)
}

export function memoryVectorMetaLine(count: number, dimension: number, t: Translate): string {
  const entries = t('settings.rag_meta_entries', '{{count}} 条片段', { count })
  const dim =
    dimension > 0
      ? t('settings.rag_meta_dimension', '{{dim}} 维', { dim: dimension })
      : t('settings.rag_meta_dimension_unknown', '维度未检测')
  return `${entries} · ${dim}`
}
