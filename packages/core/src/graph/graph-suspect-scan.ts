import {
  listAmbiguousSourceRefs,
  normalizeGraphDiscriminator,
  parseGraphNodePropsRecord
} from '@baishou/shared'

export const GRAPH_SUSPECT_LLM_CAP = 40
export const GRAPH_SUSPECT_SOURCE_SPAN_MONTHS = 18
export const GRAPH_SUSPECT_SOURCE_MIN_COUNT = 3

export type SuspectScanSignal =
  | 'multiple_role_of'
  | 'multiple_located_at'
  | 'source_span'
  | 'ambiguous'

export type SuspectScanNode = {
  id: string
  name: string
  nodeType: string
  discriminator?: string
  props: Record<string, unknown>
}

export type SuspectScanEdge = {
  fromId: string
  toId: string
  edgeType: string
  isCurrent: boolean
  sourceRef: string | null
  deletedAt?: number | null
}

export type SuspectScanHit = {
  nodeId: string
  signals: SuspectScanSignal[]
}

const SOURCE_REF_MONTH_RE = /(\d{4})-(\d{2})(?:-\d{2})?/g

export function parseSourceRefYearMonth(sourceRef: string): { year: number; month: number } | null {
  SOURCE_REF_MONTH_RE.lastIndex = 0
  const match = SOURCE_REF_MONTH_RE.exec(sourceRef)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

export function sourceRefSpanMonths(sourceRefs: string[]): number {
  const months: number[] = []
  for (const ref of sourceRefs) {
    const parsed = parseSourceRefYearMonth(ref)
    if (!parsed) continue
    months.push(parsed.year * 12 + parsed.month)
  }
  if (months.length === 0) return 0
  return Math.max(...months) - Math.min(...months)
}

export function applySuspectReasonToProps(
  props: Record<string, unknown>,
  reason: string
): Record<string, unknown> {
  return { ...props, suspectReason: reason }
}

/** 用户确认「就是一个人」或拒绝后，去掉可疑标记 */
export function removeSuspectReasonFromProps(
  props: Record<string, unknown>
): Record<string, unknown> {
  if (!('suspectReason' in props)) return props
  const next = { ...props }
  delete next.suspectReason
  return next
}

export function readSuspectReason(props: Record<string, unknown>): string {
  const raw = props.suspectReason
  return typeof raw === 'string' ? raw.trim() : ''
}

export function collectSuspectSignals(
  nodes: SuspectScanNode[],
  edges: SuspectScanEdge[]
): SuspectScanHit[] {
  const liveEdges = edges.filter((edge) => edge.deletedAt == null)
  const current = liveEdges.filter((edge) => edge.isCurrent)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const sourceRefsByNode = new Map<string, Set<string>>()

  const addSourceRef = (nodeId: string, sourceRef: string | null) => {
    const trimmed = sourceRef?.trim()
    if (!trimmed) return
    const set = sourceRefsByNode.get(nodeId) ?? new Set<string>()
    set.add(trimmed)
    sourceRefsByNode.set(nodeId, set)
  }

  for (const edge of liveEdges) {
    addSourceRef(edge.fromId, edge.sourceRef)
    addSourceRef(edge.toId, edge.sourceRef)
  }

  const roleTargets = groupCurrentTargets(current, 'role_of', nodeById, (node) => {
    return node.nodeType === 'organization' || node.nodeType === 'person'
  })
  const placeTargets = groupCurrentTargets(current, 'located_at', nodeById, (node) => {
    return node.nodeType === 'place'
  })

  const hits: SuspectScanHit[] = []
  for (const node of nodes) {
    const signals: SuspectScanSignal[] = []
    if (node.nodeType === 'person' && (roleTargets.get(node.id)?.size ?? 0) >= 2) {
      signals.push('multiple_role_of')
    }
    if (node.nodeType === 'person' && (placeTargets.get(node.id)?.size ?? 0) >= 2) {
      signals.push('multiple_located_at')
    }
    const refs = [...(sourceRefsByNode.get(node.id) ?? [])]
    if (
      refs.length >= GRAPH_SUSPECT_SOURCE_MIN_COUNT &&
      sourceRefSpanMonths(refs) >= GRAPH_SUSPECT_SOURCE_SPAN_MONTHS
    ) {
      signals.push('source_span')
    }
    if (
      normalizeGraphDiscriminator(node.discriminator) === '' &&
      listAmbiguousSourceRefs(node.props).length > 0
    ) {
      signals.push('ambiguous')
    }
    if (signals.length > 0) hits.push({ nodeId: node.id, signals })
  }
  return hits
}

function groupCurrentTargets(
  edges: SuspectScanEdge[],
  edgeType: string,
  nodeById: Map<string, SuspectScanNode>,
  acceptTarget: (node: SuspectScanNode) => boolean
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (edge.edgeType !== edgeType) continue
    const from = nodeById.get(edge.fromId)
    const to = nodeById.get(edge.toId)
    if (!from || from.nodeType !== 'person' || !to || !acceptTarget(to)) continue
    const set = out.get(from.id) ?? new Set<string>()
    set.add(to.id)
    out.set(from.id, set)
  }
  return out
}

export function buildSuspectReasonPrompt(input: {
  node: SuspectScanNode
  signals: SuspectScanSignal[]
}): { system: string; user: string } {
  return {
    system:
      '你是关系图谱可疑节点复核器。只输出严格 JSON，不要 markdown，不要解释。只能判断这个节点是否值得让用户确认拆分，不能建议自动拆分。',
    user: `下面是一个可能把多个现实实体折在一起的节点。如果值得怀疑，给出一句中文理由；如果不值得怀疑，明确说不是可疑节点。

## 节点
${JSON.stringify(
  {
    id: input.node.id,
    type: input.node.nodeType,
    name: input.node.name,
    discriminator: input.node.discriminator || '',
    signals: input.signals
  },
  null,
  0
)}

## 输出格式（严格 JSON）
{"suspect":true,"reason":"一句理由"} 或 {"suspect":false}`
  }
}

export function parseSuspectReasonDecision(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  let json: string | null = null
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        json = text.slice(start, i + 1)
        break
      }
    }
  }
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as { suspect?: unknown; reason?: unknown }
    if (parsed.suspect === false) return null
    if (parsed.suspect !== true) return null
    if (typeof parsed.reason !== 'string') return null
    const reason = parsed.reason.trim()
    return reason || null
  } catch {
    return null
  }
}

export function toSuspectScanNode(row: {
  id: string
  name: string
  nodeType: string
  discriminator?: string | null
  props?: Record<string, unknown>
  propsJson?: string | null
}): SuspectScanNode {
  return {
    id: row.id,
    name: row.name,
    nodeType: row.nodeType,
    discriminator: row.discriminator ?? '',
    props: row.props ?? parseGraphNodePropsRecord(row.propsJson)
  }
}

export function toSuspectScanEdge(row: {
  fromId: string
  toId: string
  edgeType: string
  isCurrent: boolean
  sourceRef: string | null
  deletedAt?: number | null
}): SuspectScanEdge {
  return {
    fromId: row.fromId,
    toId: row.toId,
    edgeType: row.edgeType,
    isCurrent: row.isCurrent,
    sourceRef: row.sourceRef,
    deletedAt: row.deletedAt
  }
}

export async function runGraphSuspectScan(input: {
  nodes: SuspectScanNode[]
  edges: SuspectScanEdge[]
  llm: (prompt: { system: string; user: string }) => Promise<string | null>
  persist: (node: SuspectScanNode, reason: string) => Promise<void>
  maxLlmCalls?: number
}): Promise<{ collected: number; persisted: number }> {
  const hits = collectSuspectSignals(input.nodes, input.edges)
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]))
  const uncapped = hits.filter((hit) => {
    const node = nodeById.get(hit.nodeId)
    return Boolean(node && !readSuspectReason(node.props))
  })
  const cap = input.maxLlmCalls ?? GRAPH_SUSPECT_LLM_CAP
  const limited = uncapped.slice(0, Math.max(0, cap))
  let persisted = 0
  for (const hit of limited) {
    const node = nodeById.get(hit.nodeId)
    if (!node) continue
    let reason: string | null = null
    try {
      const text = await input.llm(buildSuspectReasonPrompt({ node, signals: hit.signals }))
      reason = parseSuspectReasonDecision(text)
    } catch {
      reason = null
    }
    if (!reason) continue
    await input.persist(node, reason)
    persisted += 1
  }
  return { collected: hits.length, persisted }
}
