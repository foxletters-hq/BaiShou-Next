export type GraphReviewStatus = 'approved' | 'rejected'

export type GraphSetReviewsBatchInput = {
  reviewStatus: GraphReviewStatus
  nodeIds?: string[]
  edgeIds?: string[]
  allPending?: boolean
}

export function graphPendingItemKey(kind: 'node' | 'edge', id: string): string {
  return `${kind}:${id}`
}

export function parseGraphPendingItemKey(
  key: string
): { kind: 'node' | 'edge'; id: string } | null {
  const idx = key.indexOf(':')
  if (idx <= 0) return null
  const kind = key.slice(0, idx)
  const id = key.slice(idx + 1).trim()
  if ((kind !== 'node' && kind !== 'edge') || !id) return null
  return { kind, id }
}

export function uniqueNonEmptyIds(ids: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids ?? []) {
    const id = String(raw ?? '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function splitGraphReviewSelection(keys: Iterable<string>): {
  nodeIds: string[]
  edgeIds: string[]
} {
  const nodeIds: string[] = []
  const edgeIds: string[] = []
  const seenNodes = new Set<string>()
  const seenEdges = new Set<string>()
  for (const key of keys) {
    const parsed = parseGraphPendingItemKey(key)
    if (!parsed) continue
    if (parsed.kind === 'node') {
      if (seenNodes.has(parsed.id)) continue
      seenNodes.add(parsed.id)
      nodeIds.push(parsed.id)
    } else {
      if (seenEdges.has(parsed.id)) continue
      seenEdges.add(parsed.id)
      edgeIds.push(parsed.id)
    }
  }
  return { nodeIds, edgeIds }
}

/** Approving a node also approves its currently pending incident edges. */
export function expandApprovedGraphReviewEdgeIds(opts: {
  nodeIds: readonly string[]
  edgeIds?: readonly string[]
  pendingEdges: Array<{ id: string; fromId: string; toId: string }>
}): string[] {
  const nodeIdSet = new Set(uniqueNonEmptyIds([...opts.nodeIds]))
  const out = uniqueNonEmptyIds(opts.edgeIds ? [...opts.edgeIds] : [])
  const seen = new Set(out)
  for (const edge of opts.pendingEdges) {
    const id = String(edge.id ?? '').trim()
    if (!id || seen.has(id)) continue
    if (nodeIdSet.has(edge.fromId) || nodeIdSet.has(edge.toId)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

export function isGraphReviewStatus(value: unknown): value is GraphReviewStatus {
  return value === 'approved' || value === 'rejected'
}
