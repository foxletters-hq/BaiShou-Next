import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES } from '@baishou/database/shared'
import { normalizeGraphName } from '@baishou/shared'
import { extractFirstJsonObject } from '../graph/graph-llm-extraction.service'
import type { KnowledgeGraphExtractProgress } from './knowledge-graph-windows.util'

export type KnowledgeGraphExtractInput = {
  vaultId: string
  notebookId: string
  sourceId: string
  sourceTitle: string
  text: string
  textHash: string
  pages?: Array<{ page: number; start: number; end: number }> | null
  force?: boolean
  onProgress?: (progress: KnowledgeGraphExtractProgress) => void | Promise<void>
}

export interface KnowledgeGraphExtractLlm {
  (input: { system: string; user: string }): Promise<string | null>
}

/** 嵌入未配置时不要传 embedQuery，对齐会退化成只按名字命中。 */
export type KnowledgeGraphExtractAlignDeps = {
  embedQuery?: (text: string) => Promise<number[] | null>
  modelId?: string
}

const NODE_TYPE_SET = new Set<string>([...GRAPH_NODE_TYPES, 'source'])
const EDGE_TYPE_SET = new Set<string>(GRAPH_EDGE_TYPES)

/** 抽空 / 全窗解析失败时不得退役旧 AI 边 */
export function shouldSupersedeNotebookAiEdges(keptEdgeIds: ReadonlySet<string>): boolean {
  return keptEdgeIds.size > 0
}

/** 单窗超时或中止：跳过这一窗，不让整份资料停住。额度/配置错误仍要失败。 */
export function isKnowledgeGraphExtractWindowSkipError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (message === 'graph-extract-window-timeout') return true
  if (message.includes('waiting for first output')) return true
  if (message.includes('without further output')) return true
  if (name === 'AbortError') return true
  return message.includes('The operation was aborted')
}

export function preferNotebookReviewStatus(
  existing: string | null | undefined,
  incoming: 'approved' | 'pending'
): 'approved' | 'pending' | 'rejected' {
  if (existing === 'approved') return 'approved'
  if (existing === 'rejected') return 'rejected'
  return incoming
}

export function reviewStatusForAmbiguousEndpoint(
  status: 'approved' | 'pending' | 'rejected',
  ambiguous: boolean
): 'approved' | 'pending' | 'rejected' {
  if (!ambiguous) return status
  if (status === 'rejected') return 'rejected'
  return 'pending'
}

export function registerTypedName(
  map: Map<string, Map<string, string>>,
  nodeType: string,
  name: string,
  id: string
): void {
  const norm = normalizeGraphName(name)
  if (!norm) return
  let byType = map.get(norm)
  if (!byType) {
    byType = new Map()
    map.set(norm, byType)
  }
  byType.set(nodeType.trim().toLowerCase() || 'topic', id)
}

export function resolveTypedName(
  map: Map<string, Map<string, string>>,
  name: string,
  nodeType?: string
): string | undefined {
  const byType = map.get(normalizeGraphName(name))
  if (!byType || byType.size === 0) return undefined
  if (nodeType) return byType.get(nodeType.trim().toLowerCase())
  if (byType.size === 1) return [...byType.values()][0]
  return undefined
}

export function clampNodeType(value: string): string {
  const t = value.trim().toLowerCase()
  return NODE_TYPE_SET.has(t) ? t : 'topic'
}

export function clampEdgeType(value: string): string {
  const t = value.trim().toLowerCase()
  return EDGE_TYPE_SET.has(t) ? t : 'relates_to'
}

export function mergeAliasList(existing: string[], incoming: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const a of [...existing, ...incoming]) {
    const t = a.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export function parseRowProps(
  row?: { props?: Record<string, unknown>; propsJson?: string | null } | null
): Record<string, unknown> {
  if (!row) return {}
  if (row.props && typeof row.props === 'object' && !Array.isArray(row.props)) {
    return { ...row.props }
  }
  const raw = row.propsJson
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseRowAliases(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function parseExtractJson(text: string | null): {
  entities: Array<{
    name?: string
    type?: string
    aliases?: string[]
    summary?: string
    confidence?: number
  }>
  edges: Array<{ from?: string; to?: string; type?: string; excerpt?: string; confidence?: number }>
} | null {
  if (!text?.trim()) return null
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as {
      entities?: unknown
      edges?: unknown
    }
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : []
    }
  } catch {
    return null
  }
}
