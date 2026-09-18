import { graphNodeCardText, type GraphSimilarPending } from '@baishou/shared'

export type { GraphSimilarPending }

export { graphNodeCardText }

export type AlignableEntity = {
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
  /** 本篇/本窗原文摘录，给同名多候选判定和向量合并判定共用。 */
  sourceContext?: string
}

export type AlignedEntityHit = {
  id: string
  name: string
  aliases: string[]
  summary?: string
  nodeType?: string
  discriminator?: string
}

export const NAME_CANDIDATE_SOURCE_CONTEXT_MAX = 800

export function clipNameCandidateSourceContext(text: string | null | undefined): string {
  const t = String(text ?? '')
  if (t.length <= NAME_CANDIDATE_SOURCE_CONTEXT_MAX) return t
  return t.slice(0, NAME_CANDIDATE_SOURCE_CONTEXT_MAX)
}

export type AlignedEntity = {
  key: string
  id: string
  canonicalName: string
  aliases: string[]
  summary: string
  reused: boolean
  mergedBy: 'name' | 'llm' | 'create'
  /** 对齐阶段为召回算出的向量；名字命中快路没有算过，不带。 */
  embedding?: number[]
  /** 算上述向量时用的名片文本。与节点最终名片逐字相同才允许落库。 */
  embedText?: string
  /**
   * 按名字命中多条且未能从已登记候选里判定归属时为真。
   * 这时 id 取裸名那一条，避免同名不同人被静默折成一个人。
   */
  ambiguous?: boolean
  /** 向量合并吃不准时记下，落库为相似待合并；不把节点标成待确认。 */
  similarPending?: GraphSimilarPending
}

export type EntityAlignJudgeIncoming = {
  ref: string
  name: string
  nodeType: string
  aliases: string[]
  summary: string
  sourceContext?: string
}

export type EntityAlignJudgeExisting = {
  ref: string
  id: string
  name: string
  nodeType: string
  aliases: string[]
  summary: string
}

export type EntityAlignJudgeInput = {
  incoming: EntityAlignJudgeIncoming[]
  existing: EntityAlignJudgeExisting[]
}

export type EntityAlignJudgeDecision = {
  incomingRef: string
  existingRef?: string
  sameAsIncomingRef?: string
}

export type EntityAlignUncertainDecision = {
  incomingRef: string
  existingRef: string
  reason?: string
  similarity?: number
}

export type EntityAlignJudgeResult = {
  merges: EntityAlignJudgeDecision[]
  uncertain: EntityAlignUncertainDecision[]
}

export function normalizeEntityAlignJudgeResult(
  raw: EntityAlignJudgeResult | EntityAlignJudgeDecision[] | null | undefined
): EntityAlignJudgeResult | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return { merges: raw, uncertain: [] }
  if (typeof raw !== 'object') return null
  const merges = Array.isArray(raw.merges) ? raw.merges : []
  const uncertain = Array.isArray(raw.uncertain) ? raw.uncertain : []
  return { merges, uncertain }
}

export type EntityAlignJudgeUncertain = EntityAlignUncertainDecision
export type EntityAlignJudgeOutput = EntityAlignJudgeResult

export type EntityAlignNameIncoming = {
  name: string
  nodeType: string
  aliases: string[]
  summary: string
}

export type EntityAlignNameCandidate = {
  id: string
  name: string
  discriminator?: string
  aliases: string[]
  summary: string
}

export type EntityAlignNameJudgeInput = {
  incoming: EntityAlignNameIncoming
  candidates: EntityAlignNameCandidate[]
  sourceContext?: string
}

export type EntityAlignLookup = {
  findCandidatesByNameOrAlias: (name: string, type: string) => Promise<AlignedEntityHit[]>
  searchByVector?: (
    vector: number[],
    type: string,
    topK?: number
  ) => Promise<Array<AlignedEntityHit & { distance: number }>>
  embedQuery?: (text: string) => Promise<number[] | null>
  nodeIdForEntity: (type: string, name: string) => string
  /** 二次 LLM：判断合并或吃不准。返回 null 时全部新建，不再做向量硬合并。 */
  judgeMerges?: (
    input: EntityAlignJudgeInput
  ) => Promise<EntityAlignJudgeResult | EntityAlignJudgeDecision[] | null>
  /**
   * 同名多候选判定：只能返回 candidates 里已有的 id，或 null。
   * 禁止编造区分信息或新 id。
   */
  judgeNameCandidates?: (input: EntityAlignNameJudgeInput) => Promise<string | null>
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

export function embedText(entity: AlignableEntity): string {
  return graphNodeCardText(entity.name, entity.summary)
}

/**
 * 对齐算出的向量只有在名片文本与节点最终落库名片逐字相同时才能交给同步。
 * 合并到已有节点时规范名或摘要可能已变，这时必须交给后面的集中补齐，不能把旧称呼的向量写进去。
 */
export function alignedEmbeddingForNodeCard(
  aligned: Pick<AlignedEntity, 'embedding' | 'embedText'> | undefined,
  nodeName: string,
  nodeSummary: string
): { embedding: number[]; text: string } | null {
  if (!aligned?.embedding?.length || aligned.embedText == null) return null
  const card = graphNodeCardText(nodeName, nodeSummary)
  if (aligned.embedText !== card) return null
  return { embedding: aligned.embedding, text: aligned.embedText }
}
