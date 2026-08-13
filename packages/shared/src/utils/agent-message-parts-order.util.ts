import { normalizePartData } from './message-attachment.util'

export type AgentPartOrderLike = {
  id?: string
  type?: string
  data?: unknown
  createdAt?: Date | number | string | null
}

function partSeq(part: AgentPartOrderLike): number | null {
  const raw = normalizePartData(part.data).seq
  const seq = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(seq) ? seq : null
}

function partCreatedAtMs(part: AgentPartOrderLike): number {
  const value = part.createdAt
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

/**
 * 无 seq 时的扁平落库兜底顺序：思考 → 工具 → 正文。
 * （旧版 persist 曾写成 正文 → 思考 → 工具，刷新后会整段跑到最下面。）
 */
function partFlatRank(part: AgentPartOrderLike): number {
  const type = String(part.type ?? '')
  if (type === 'text' && Boolean(normalizePartData(part.data).isReasoning)) return 0
  if (type === 'tool') return 1
  if (type === 'text') return 2
  if (type === 'file_change') return 3
  if (type === 'agent_gate') return 4
  return 5
}

/** 按 data.seq（优先）/ 扁平类型兜底 / createdAt / 原下标 稳定排序 */
export function sortAgentMessageParts<T extends AgentPartOrderLike>(parts: T[] | undefined): T[] {
  if (!parts?.length) return []
  return parts
    .map((part, index) => ({ part, index }))
    .sort((a, b) => {
      const seqA = partSeq(a.part)
      const seqB = partSeq(b.part)
      if (seqA != null && seqB != null && seqA !== seqB) return seqA - seqB
      if (seqA != null && seqB == null) return -1
      if (seqA == null && seqB != null) return 1

      const rankDiff = partFlatRank(a.part) - partFlatRank(b.part)
      if (rankDiff !== 0) return rankDiff

      const timeDiff = partCreatedAtMs(a.part) - partCreatedAtMs(b.part)
      if (timeDiff !== 0) return timeDiff
      return a.index - b.index
    })
    .map(({ part }) => part)
}
