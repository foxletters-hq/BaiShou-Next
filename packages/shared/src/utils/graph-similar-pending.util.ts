/** 抽取消歧：吃不准时写在节点 props 上的「相似待合并」，不改 reviewStatus。 */

export const GRAPH_SIMILAR_PENDING_KEY = 'similarPending'
export const GRAPH_SIMILAR_PENDING_LIST_KEY = 'similarPendingList'
/** 召回给模型看、以及进入相似待合并，共用这一条：必须大于 70%。 */
export const GRAPH_SIMILAR_PENDING_MIN_SIMILARITY = 0.7
export const GRAPH_ALIGN_MIN_SIMILARITY_PERCENT = Math.round(
  GRAPH_SIMILAR_PENDING_MIN_SIMILARITY * 100
)

/** 向量分是 0–1；模型有时会写成 45 这种百分数。 */
export function normalizeGraphSimilarPendingSimilarity(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value > 1 && value <= 100) return value / 100
  if (value < 0 || value > 100) return 0
  return value
}

export function meetsGraphSimilarPendingThreshold(similarity: number): boolean {
  return normalizeGraphSimilarPendingSimilarity(similarity) > GRAPH_SIMILAR_PENDING_MIN_SIMILARITY
}

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

export type GraphSimilarMergeGroup = {
  /** 合并后保留的节点 */
  survivorId: string
  /** 并入 survivor 的节点 */
  loserIds: string[]
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
  const similarity = normalizeGraphSimilarPendingSimilarity(
    typeof row.similarity === 'number' && Number.isFinite(row.similarity) ? row.similarity : 0
  )
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
  const items =
    single && !fromList.some((item) => item.peerId === single.peerId)
      ? [single, ...fromList]
      : fromList.length > 0
        ? fromList
        : single
          ? [single]
          : []
  return items.filter((item) => meetsGraphSimilarPendingThreshold(item.similarity))
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
  if (!parsed || !meetsGraphSimilarPendingThreshold(parsed.similarity)) return { ...props }
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

/**
 * 把「相似待合并」对按连通簇分组，供一键合并使用。
 * 单条合并方向固定为 nodeId 并入 peerId；同一簇内优先选择从未作为 nodeId 的节点作为 survivor，
 * 避免顺序合并时先删掉后面还要用到的节点。
 */
export function groupSimilarPendingPairsForMerge(
  pairs: ReadonlyArray<Pick<GraphSimilarPendingPair, 'nodeId' | 'peerId'>>
): GraphSimilarMergeGroup[] {
  const parent = new Map<string, string>()
  const appearance: string[] = []
  const peerRank = new Map<string, number>()
  const everLoser = new Set<string>()

  const ensure = (id: string) => {
    if (parent.has(id)) return
    parent.set(id, id)
    appearance.push(id)
  }
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root) as string
    while (parent.get(id) !== root) {
      const next = parent.get(id) as string
      parent.set(id, root)
      id = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent.set(rootB, rootA)
  }

  for (const pair of pairs) {
    const nodeId = typeof pair.nodeId === 'string' ? pair.nodeId.trim() : ''
    const peerId = typeof pair.peerId === 'string' ? pair.peerId.trim() : ''
    if (!nodeId || !peerId || nodeId === peerId) continue
    ensure(nodeId)
    ensure(peerId)
    if (!peerRank.has(peerId)) peerRank.set(peerId, peerRank.size)
    everLoser.add(nodeId)
    union(nodeId, peerId)
  }

  const byRoot = new Map<string, string[]>()
  for (const id of appearance) {
    const root = find(id)
    const ids = byRoot.get(root)
    if (ids) ids.push(id)
    else byRoot.set(root, [id])
  }

  const rankOf = (id: string) => peerRank.get(id) ?? Number.POSITIVE_INFINITY
  const pickSurvivor = (ids: string[]): string => {
    const candidates = ids.filter((id) => !everLoser.has(id))
    const pool = candidates.length > 0 ? candidates : ids
    return pool.reduce((best, id) => (rankOf(id) < rankOf(best) ? id : best))
  }

  const out: GraphSimilarMergeGroup[] = []
  for (const ids of byRoot.values()) {
    if (ids.length < 2) continue
    const survivorId = pickSurvivor(ids)
    out.push({
      survivorId,
      loserIds: ids.filter((id) => id !== survivorId)
    })
  }
  return out
}
