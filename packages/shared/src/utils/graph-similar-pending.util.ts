/** 抽取消歧：吃不准时写在节点 props 上的「相似待合并」，不改 reviewStatus。 */

export const GRAPH_SIMILAR_PENDING_KEY = 'similarPending'
export const GRAPH_SIMILAR_PENDING_LIST_KEY = 'similarPendingList'

export type GraphSimilarPending = {
  peerId: string
  similarity: number
  reason: string
  sourceExcerpt?: string
  createdAt: string
}

export type GraphSimilarPendingPair = {
  nodeId: string
  nodeName: string
  peerId: string
  peerName: string
  similarity: number
  reason: string
  sourceExcerpt?: string
  createdAt: string
}

export function parseGraphNodePropsRecord(
  propsJson: string | null | undefined
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(propsJson || '{}') as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export function parseGraphSimilarPending(raw: unknown): GraphSimilarPending | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const peerId = typeof row.peerId === 'string' ? row.peerId.trim() : ''
  if (!peerId) return null
  const similarity =
    typeof row.similarity === 'number' && Number.isFinite(row.similarity) ? row.similarity : 0
  const reason = typeof row.reason === 'string' ? row.reason : ''
  const createdAt = typeof row.createdAt === 'string' ? row.createdAt : ''
  const sourceExcerpt =
    typeof row.sourceExcerpt === 'string' && row.sourceExcerpt.trim()
      ? row.sourceExcerpt
      : undefined
  return { peerId, similarity, reason, createdAt, ...(sourceExcerpt ? { sourceExcerpt } : {}) }
}

export function listGraphSimilarPending(props: Record<string, unknown>): GraphSimilarPending[] {
  const fromList = Array.isArray(props[GRAPH_SIMILAR_PENDING_LIST_KEY])
    ? props[GRAPH_SIMILAR_PENDING_LIST_KEY].map(parseGraphSimilarPending).filter(
        (item): item is GraphSimilarPending => item != null
      )
    : []
  const single = parseGraphSimilarPending(props[GRAPH_SIMILAR_PENDING_KEY])
  if (single && !fromList.some((item) => item.peerId === single.peerId)) {
    return [single, ...fromList]
  }
  return fromList.length > 0 ? fromList : single ? [single] : []
}

export function nodePropsHaveSimilarPending(propsJson: string | null | undefined): boolean {
  return listGraphSimilarPending(parseGraphNodePropsRecord(propsJson)).length > 0
}

function writeSimilarPendingList(
  props: Record<string, unknown>,
  items: GraphSimilarPending[]
): Record<string, unknown> {
  const next = { ...props }
  delete next[GRAPH_SIMILAR_PENDING_KEY]
  delete next[GRAPH_SIMILAR_PENDING_LIST_KEY]
  if (items.length === 0) return next
  if (items.length === 1) {
    next[GRAPH_SIMILAR_PENDING_KEY] = items[0]
    return next
  }
  next[GRAPH_SIMILAR_PENDING_LIST_KEY] = items
  return next
}

export function applySimilarPendingToProps(
  props: Record<string, unknown>,
  pending: GraphSimilarPending
): Record<string, unknown> {
  const parsed = parseGraphSimilarPending(pending)
  if (!parsed) return { ...props }
  const current = listGraphSimilarPending(props).filter((item) => item.peerId !== parsed.peerId)
  current.push(parsed)
  return writeSimilarPendingList(props, current)
}

export function applyAlignedSimilarPendingToProps(
  props: Record<string, unknown>,
  input: { reused?: boolean; similarPending?: GraphSimilarPending } | undefined
): Record<string, unknown> {
  if (!input || input.reused || !input.similarPending) return props
  return applySimilarPendingToProps(props, input.similarPending)
}

export function removeSimilarPendingPeerFromProps(
  props: Record<string, unknown>,
  peerId: string
): Record<string, unknown> {
  const target = peerId.trim()
  if (!target) return { ...props }
  return writeSimilarPendingList(
    props,
    listGraphSimilarPending(props).filter((item) => item.peerId !== target)
  )
}

export function similarPendingPeerSetsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>
): boolean {
  const a = new Set(listGraphSimilarPending(left).map((item) => item.peerId))
  const b = new Set(listGraphSimilarPending(right).map((item) => item.peerId))
  if (a.size !== b.size) return false
  for (const id of a) {
    if (!b.has(id)) return false
  }
  return true
}

/** 与落库/复核侧已有调用名对齐，避免两套 helper。 */
export const upsertSimilarPending = applySimilarPendingToProps
export const readSimilarPendingList = listGraphSimilarPending
export const removeSimilarPending = removeSimilarPendingPeerFromProps
export const propsHaveSimilarPending = nodePropsHaveSimilarPending

export function collectSimilarPendingPairs(
  nodes: Array<{ id: string; name: string; propsJson?: string; props?: Record<string, unknown> }>,
  peerNameById: ReadonlyMap<string, string>
): GraphSimilarPendingPair[] {
  const out: GraphSimilarPendingPair[] = []
  for (const node of nodes) {
    const props = node.props ?? parseGraphNodePropsRecord(node.propsJson)
    for (const pending of listGraphSimilarPending(props)) {
      const peerName = peerNameById.get(pending.peerId)
      if (!peerName) continue
      out.push({
        nodeId: node.id,
        nodeName: node.name,
        peerId: pending.peerId,
        peerName,
        similarity: pending.similarity,
        reason: pending.reason,
        sourceExcerpt: pending.sourceExcerpt,
        createdAt: pending.createdAt
      })
    }
  }
  return out
}
