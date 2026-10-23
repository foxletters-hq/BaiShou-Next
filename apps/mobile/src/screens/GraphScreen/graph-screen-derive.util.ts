/* eslint-disable i18n-chinese/no-hardcoded-chinese -- 本文件只产出 t() 的 key 与 fallback */
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  isDefaultGraphMonthRange,
  isDefaultGraphSelfName,
  isGraphExtractBusyStatus,
  isGraphSearchEmbeddingRequiredError,
  listAmbiguousSourceRefs,
  normalizeGraphFilePath,
  type GraphMonthRange,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import type { GraphCostEstimate, GraphScreenNode } from './graph-screen.types'

export function parseGraphSourceDate(dateOrRef: string | null | undefined): {
  raw: string
  date: string | null
} {
  const raw = String(dateOrRef || '').trim()
  const dateMatch = raw.match(/(\d{4}-\d{2}-\d{2})/)
  const date = dateMatch?.[1] ?? (/^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null)
  return { raw, date }
}

export function filterGraphSearchHits<T extends { id?: string; reviewStatus?: string }>(
  hits: T[] | null | undefined
): T[] {
  return (hits || []).filter((item) => item?.id && item.reviewStatus !== 'rejected')
}

export function graphSearchHitViewState<T extends { id: string }>(
  list: T[]
): {
  highlightIds: string[]
  localView: { nodes: T[]; edges: [] } | null
  pinNeighborhood: boolean
  locateIds: string[] | null
} {
  const ids = list.map((item) => item.id)
  if (list.length === 0) {
    return {
      highlightIds: ids,
      localView: null,
      pinNeighborhood: false,
      locateIds: null
    }
  }
  return {
    highlightIds: ids,
    localView: { nodes: list, edges: [] },
    pinNeighborhood: true,
    locateIds: ids
  }
}

export function buildGraphQueueByPath<T extends { filePath: string }>(
  items: T[] | null | undefined
): Map<string, T> {
  const map = new Map<string, T>()
  for (const item of items ?? []) {
    map.set(normalizeGraphFilePath(item.filePath), item)
  }
  return map
}

export function graphExtractAlreadyQueued(
  requestedPaths: string[],
  queueByPath: Map<string, { status?: string }>
): boolean {
  return requestedPaths.some((path) => {
    const q = queueByPath.get(normalizeGraphFilePath(path))
    return isGraphExtractBusyStatus(q?.status)
  })
}

export function graphExtractRequestedPaths(
  filePaths: string[] | undefined,
  pendingReextract: Array<{ filePath?: string }>
): string[] {
  return filePaths?.length ? filePaths : pendingReextract.map((item) => String(item.filePath || ''))
}

export function graphScreenPhaseKey(opts: {
  awakenPending: boolean
  showAwakenGate: boolean
}): 'boot' | 'awaken' | 'main' {
  return opts.awakenPending ? 'boot' : opts.showAwakenGate ? 'awaken' : 'main'
}

export function shouldShowGraphEmptyGuide(opts: {
  selfNameReady?: boolean | null
  dismissGuide: boolean
  canvasNodeCount: number
  estimate: GraphCostEstimate | null
  pendingReextractCount: number
  monthRange: GraphMonthRange
}): boolean {
  return (
    !opts.dismissGuide &&
    opts.canvasNodeCount === 0 &&
    (opts.estimate?.entryCount ?? opts.pendingReextractCount) > 0 &&
    isDefaultGraphMonthRange(opts.monthRange)
  )
}

export function shouldShowGraphMonthEmpty(opts: {
  selfNameReady?: boolean | null
  showEmptyGuide: boolean
  canvasNodeCount: number
  pinNeighborhood: boolean
}): boolean {
  return !opts.showEmptyGuide && opts.canvasNodeCount === 0 && !opts.pinNeighborhood
}

export function graphTokenCountDisplay(n: number): {
  key: 'graph.tokens_wan' | 'graph.tokens_count'
  fallback: string
  params: { n: string | number }
} {
  if (n >= 10000) {
    return {
      key: 'graph.tokens_wan',
      fallback: '约 {{n}} 万',
      params: { n: (n / 10000).toFixed(1) }
    }
  }
  return {
    key: 'graph.tokens_count',
    fallback: '约 {{n}}',
    params: { n }
  }
}

export function graphProfileFormFromAwaken(profile: UserProfile): {
  nickname: string
  birthday: string
  gender: UserGender | ''
  customGender?: string
} {
  const nick = profile.nickname?.trim() ?? ''
  const base = {
    nickname: isDefaultGraphSelfName(nick) ? '' : nick,
    birthday: profile.birthday?.trim() || '',
    gender: ((profile.gender as UserGender | undefined) || '') as UserGender | ''
  }
  const custom = profile.customGender?.trim()
  return custom ? { ...base, customGender: custom } : base
}

export function findGraphSelfPersonHit<T extends { name?: string; aliases?: unknown }>(
  hits: T[] | null | undefined,
  prevName: string
): T | undefined {
  return (hits || []).find((h) => {
    if (h.name === prevName) return true
    const aliases = Array.isArray(h.aliases) ? h.aliases : []
    return aliases.includes(prevName)
  })
}

export function buildGraphSelfPersonAliases(
  existingAliases: unknown,
  prevName: string,
  nextName: string
): string[] {
  const aliases = new Set<string>([
    ...(Array.isArray(existingAliases) ? (existingAliases as string[]) : []),
    prevName
  ])
  aliases.delete(nextName)
  return [...aliases]
}

export function graphExtractErrorCopy(message: string): { key: string; fallback: string } | null {
  if (message === GRAPH_SELF_NAME_REQUIRED_ERROR) {
    return { key: 'graph.self_name_required', fallback: '请先在个人资料中设置昵称后再整理' }
  }
  if (message === GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR) {
    return {
      key: 'graph.extract_embedding_required',
      fallback: '请先配置嵌入模型，并完成本篇日记的向量化后再抽取'
    }
  }
  if (message === GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR) {
    return {
      key: 'graph.extract_diary_not_embedded',
      fallback: '这篇日记还没有向量，请先嵌入后再抽取'
    }
  }
  return null
}

export function graphSearchErrorCopy(
  error: unknown
): { key: string; fallback: string } | { raw: string } {
  if (isGraphSearchEmbeddingRequiredError(error)) {
    return {
      key: 'graph.search_embedding_required',
      fallback: '请先配置嵌入模型，才能用语义搜索节点'
    }
  }
  return { raw: error instanceof Error ? error.message : String(error) }
}

export function findGraphScreenNode(
  id: string,
  nodes: GraphScreenNode[],
  pendingNodes: GraphScreenNode[]
): GraphScreenNode | null {
  return nodes.find((n) => n.id === id) || pendingNodes.find((n) => n.id === id) || null
}

export function resolveGraphNodeSourcePreview(params: {
  nodeId: string
  node?: { propsJson?: string | null } | null
  edges?: Array<{
    fromId: string
    toId: string
    sourceRef?: string | null
    sourceExcerpt?: string | null
  }> | null
}): { sourceRef: string | null; excerpt: string | null } {
  const touchingEdges = (params.edges ?? []).filter(
    (e) => e.fromId === params.nodeId || e.toId === params.nodeId
  )
  const edgeWithDate = touchingEdges.find((e) =>
    Boolean(e.sourceRef && parseGraphSourceDate(e.sourceRef).date)
  )
  if (edgeWithDate) {
    return {
      sourceRef: edgeWithDate.sourceRef ?? null,
      excerpt: edgeWithDate.sourceExcerpt ?? null
    }
  }
  const edgeWithExcerpt = touchingEdges.find((e) => Boolean(e.sourceExcerpt))
  if (edgeWithExcerpt) {
    return {
      sourceRef: edgeWithExcerpt.sourceRef ?? null,
      excerpt: edgeWithExcerpt.sourceExcerpt ?? null
    }
  }
  let parsedProps: Record<string, unknown> | null = null
  if (params.node?.propsJson) {
    try {
      parsedProps = JSON.parse(params.node.propsJson)
    } catch {
      parsedProps = null
    }
  }
  const ambiguous = parsedProps ? listAmbiguousSourceRefs(parsedProps) : []
  if (ambiguous.length > 0) {
    return {
      sourceRef: ambiguous[0],
      excerpt: null
    }
  }
  return {
    sourceRef: null,
    excerpt: null
  }
}
