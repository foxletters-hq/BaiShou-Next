/* eslint-disable i18n-chinese/no-hardcoded-chinese -- 本文件只产出 t() 的 key 与 fallback */
import {
  GRAPH_EXTRACT_DIARY_NOT_EMBEDDED_ERROR,
  GRAPH_EXTRACT_EMBEDDING_REQUIRED_ERROR,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  isDefaultGraphMonthRange,
  isDefaultGraphSelfName,
  isGraphExtractBusyStatus,
  isGraphSearchEmbeddingRequiredError,
  normalizeGraphFilePath,
  type GraphMonthRange,
  type UserGender,
  type UserProfile
} from '@baishou/shared'
import type { GraphCostEstimate, GraphPageNode } from './graph-page.types'

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

export function graphPagePhaseKey(opts: {
  awakenPending: boolean
  showAwakenGate: boolean
}): 'boot' | 'awaken' | 'main' {
  return opts.awakenPending ? 'boot' : opts.showAwakenGate ? 'awaken' : 'main'
}

export function shouldShowGraphEmptyGuide(opts: {
  selfNameReady: boolean | null
  dismissGuide: boolean
  canvasNodeCount: number
  estimate: GraphCostEstimate | null
  pendingReextractCount: number
  monthRange: GraphMonthRange
}): boolean {
  return (
    opts.selfNameReady === true &&
    !opts.dismissGuide &&
    opts.canvasNodeCount === 0 &&
    (opts.estimate?.entryCount ?? opts.pendingReextractCount) > 0 &&
    isDefaultGraphMonthRange(opts.monthRange)
  )
}

export function shouldShowGraphMonthEmpty(opts: {
  selfNameReady: boolean | null
  showEmptyGuide: boolean
  canvasNodeCount: number
  pinNeighborhood: boolean
}): boolean {
  return (
    opts.selfNameReady === true &&
    !opts.showEmptyGuide &&
    opts.canvasNodeCount === 0 &&
    !opts.pinNeighborhood
  )
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
} {
  const nick = profile.nickname?.trim() ?? ''
  return {
    nickname: isDefaultGraphSelfName(nick) ? '' : nick,
    birthday: profile.birthday?.trim() || '',
    gender: (profile.gender as UserGender | undefined) || ''
  }
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
    return { key: 'graph.self_name_required', fallback: '请先设置图谱自称后再抽取' }
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

export function findGraphPageNode(
  id: string,
  nodes: GraphPageNode[],
  pendingNodes: GraphPageNode[]
): GraphPageNode | null {
  return nodes.find((n) => n.id === id) || pendingNodes.find((n) => n.id === id) || null
}
