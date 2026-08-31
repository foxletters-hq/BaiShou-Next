import { entityAlignKey, graphCosineDistanceToSimilarity } from '@baishou/shared'

/** 只把相似度大于 50% 的库内节点给模型看；合不合并由二次 LLM 决定。 */
const CANDIDATE_MIN_SIMILARITY = 0.5
const VECTOR_CANDIDATE_TOP_K = 5
const SUMMARY_PROMPT_MAX = 80

export type AlignableEntity = {
  name: string
  nodeType: string
  aliases?: string[]
  summary?: string
}

export type AlignedEntityHit = {
  id: string
  name: string
  aliases: string[]
  summary?: string
  nodeType?: string
}

export type AlignedEntity = {
  key: string
  id: string
  canonicalName: string
  aliases: string[]
  summary: string
  reused: boolean
  mergedBy: 'name' | 'llm' | 'create'
}

export type EntityAlignJudgeIncoming = {
  ref: string
  name: string
  nodeType: string
  aliases: string[]
  summary: string
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

export type EntityAlignLookup = {
  findByNameOrAlias: (name: string, type: string) => Promise<AlignedEntityHit | null>
  searchByVector?: (
    vector: number[],
    type: string,
    topK?: number
  ) => Promise<Array<AlignedEntityHit & { distance: number }>>
  embedQuery?: (text: string) => Promise<number[] | null>
  nodeIdForEntity: (type: string, name: string) => string
  /** 二次 LLM：只判断合并。返回 null 时全部新建，不再做向量硬合并。 */
  judgeMerges?: (input: EntityAlignJudgeInput) => Promise<EntityAlignJudgeDecision[] | null>
}

function mergeAliasList(existing: string[], incoming: string[]): string[] {
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

function embedText(entity: AlignableEntity): string {
  return `${entity.name}\n${entity.summary || ''}`.trim()
}

function clipSummary(text: string): string {
  const t = text.trim()
  if (t.length <= SUMMARY_PROMPT_MAX) return t
  return `${t.slice(0, SUMMARY_PROMPT_MAX)}…`
}

function uniqueEntities(entities: AlignableEntity[]): Map<string, AlignableEntity> {
  const unique = new Map<string, AlignableEntity>()
  for (const raw of entities) {
    const name = String(raw.name || '').trim()
    if (!name) continue
    const nodeType = String(raw.nodeType || 'topic').trim().toLowerCase() || 'topic'
    const key = entityAlignKey(nodeType, name)
    const prev = unique.get(key)
    if (!prev) {
      unique.set(key, {
        name,
        nodeType,
        aliases: raw.aliases ?? [],
        summary: raw.summary ?? ''
      })
      continue
    }
    unique.set(key, {
      name: prev.name,
      nodeType,
      aliases: mergeAliasList(prev.aliases ?? [], [name, ...(raw.aliases ?? [])]),
      summary: prev.summary || raw.summary || ''
    })
  }
  return unique
}

export function buildEntityAlignPrompt(input: EntityAlignJudgeInput): {
  system: string
  user: string
} {
  return {
    system:
      '你是关系图谱实体对齐器。只输出严格 JSON，不要 markdown，不要解释。只在确定是现实中的同一个实体时才合并。',
    user: `下面是本批新抽出的称呼，以及库里可能对应的已有节点。判断哪些是同一个人/地点/组织等。

## 规则
1. 只合并确定是同一实体的项；同名不同人、不同城市、不确定的一律不要合并
2. incoming 可以并到 existing，也可以本批 incoming 互相合并
3. 合并后 existing 的 name 保持不变，incoming 的称呼会变成别名
4. 没有把握就不要出现在 merges 里（视为新建）

## incoming
${JSON.stringify(
      input.incoming.map((item) => ({
        ref: item.ref,
        type: item.nodeType,
        name: item.name,
        aliases: item.aliases,
        summary: clipSummary(item.summary)
      })),
      null,
      0
    )}

## existing
${JSON.stringify(
      input.existing.map((item) => ({
        ref: item.ref,
        type: item.nodeType,
        name: item.name,
        aliases: item.aliases,
        summary: clipSummary(item.summary)
      })),
      null,
      0
    )}

## 输出格式（严格 JSON）
{"merges":[{"incoming":"i1","existing":"e1"},{"incoming":"i2","same_as":"i1"}]}`
  }
}

export function parseEntityAlignDecisions(text: string | null | undefined): EntityAlignJudgeDecision[] | null {
  if (!text?.trim()) return null
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as { merges?: unknown }
    if (!Array.isArray(parsed.merges)) return null
    const out: EntityAlignJudgeDecision[] = []
    for (const raw of parsed.merges) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as { incoming?: unknown; existing?: unknown; same_as?: unknown }
      const incomingRef = String(row.incoming || '').trim()
      if (!incomingRef) continue
      const existingRef = String(row.existing || '').trim()
      const sameAsIncomingRef = String(row.same_as || '').trim()
      out.push({
        incomingRef,
        existingRef: existingRef || undefined,
        sameAsIncomingRef: sameAsIncomingRef || undefined
      })
    }
    return out
  } catch {
    return null
  }
}

function extractFirstJsonObject(text: string): string | null {
  const stripped = text
    .replace(/```(?:json)?\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  const start = stripped.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]!
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
      if (depth === 0) return stripped.slice(start, i + 1)
    }
  }
  return null
}

/**
 * 名字/别名等值先复用；其余只召回相似度大于 50% 的候选，交给二次 LLM 判断。
 * 模型失败或未配置时全部新建，不做向量硬合并。
 */
export async function alignEntityPool(
  entities: AlignableEntity[],
  lookup: EntityAlignLookup
): Promise<Map<string, AlignedEntity>> {
  const out = new Map<string, AlignedEntity>()
  const unique = uniqueEntities(entities)
  const unresolved: Array<{ key: string; entity: AlignableEntity }> = []

  const nameHits = await Promise.all(
    [...unique].map(async ([key, entity]) => ({
      key,
      entity,
      hit: await lookup.findByNameOrAlias(entity.name, entity.nodeType)
    }))
  )
  for (const { key, entity, hit } of nameHits) {
    if (hit) {
      out.set(key, {
        key,
        id: hit.id,
        canonicalName: hit.name,
        aliases: mergeAliasList(hit.aliases, [entity.name, ...(entity.aliases ?? [])]),
        summary: entity.summary || hit.summary || '',
        reused: true,
        mergedBy: 'name'
      })
      continue
    }
    unresolved.push({ key, entity })
  }

  if (unresolved.length === 0) return out

  const vectors = new Map<string, number[]>()
  if (lookup.embedQuery) {
    await Promise.all(
      unresolved.map(async ({ key, entity }) => {
        try {
          const vector = await lookup.embedQuery!(embedText(entity))
          if (vector?.length) vectors.set(key, vector)
        } catch {
          // optional
        }
      })
    )
  }

  if (lookup.judgeMerges) {
    const judged = await alignWithLlm(unresolved, vectors, lookup, out)
    if (judged) return out
  }

  for (const item of unresolved) {
    if (!out.has(item.key)) assignCreate(item, lookup, out)
  }
  return out
}

async function alignWithLlm(
  unresolved: Array<{ key: string; entity: AlignableEntity }>,
  vectors: Map<string, number[]>,
  lookup: EntityAlignLookup,
  out: Map<string, AlignedEntity>
): Promise<boolean> {
  const incoming: EntityAlignJudgeIncoming[] = unresolved.map((item, index) => ({
    ref: `i${index + 1}`,
    name: item.entity.name,
    nodeType: item.entity.nodeType,
    aliases: item.entity.aliases ?? [],
    summary: item.entity.summary ?? ''
  }))
  const incomingByRef = new Map(incoming.map((item, index) => [item.ref, unresolved[index]!]))

  const existingById = new Map<string, AlignedEntityHit & { nodeType: string }>()
  if (lookup.searchByVector) {
    const recalled = await Promise.all(
      unresolved.map(async ({ key, entity }) => {
        const vector = vectors.get(key)
        if (!vector) return [] as Array<AlignedEntityHit & { distance: number; nodeType: string }>
        try {
          const hits = await lookup.searchByVector!(vector, entity.nodeType, VECTOR_CANDIDATE_TOP_K)
          return hits
            .filter(
              (hit) =>
                (!hit.nodeType || hit.nodeType === entity.nodeType) &&
                shouldRecallAlignCandidate(hit.distance)
            )
            .map((hit) => ({ ...hit, nodeType: entity.nodeType }))
        } catch {
          return []
        }
      })
    )
    for (const hits of recalled) {
      for (const hit of hits) {
        if (!existingById.has(hit.id)) existingById.set(hit.id, hit)
      }
    }
  }

  const existing: EntityAlignJudgeExisting[] = [...existingById.values()].map((hit, index) => ({
    ref: `e${index + 1}`,
    id: hit.id,
    name: hit.name,
    nodeType: hit.nodeType,
    aliases: hit.aliases,
    summary: hit.summary ?? ''
  }))

  if (incoming.length === 1 && existing.length === 0) {
    assignCreate(unresolved[0]!, lookup, out)
    return true
  }

  let decisions: EntityAlignJudgeDecision[] | null = null
  try {
    decisions = (await lookup.judgeMerges?.({ incoming, existing })) ?? null
  } catch {
    decisions = null
  }
  if (!decisions) return false

  const existingByRef = new Map(existing.map((item) => [item.ref, item]))
  const parent = new Map<string, string>()
  const existingRoot = new Map<string, EntityAlignJudgeExisting>()
  const find = (ref: string): string => {
    const next = parent.get(ref) ?? ref
    if (next === ref) return ref
    const root = find(next)
    parent.set(ref, root)
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const item of incoming) parent.set(item.ref, item.ref)

  for (const decision of decisions) {
    if (!incomingByRef.has(decision.incomingRef)) continue
    const incomingItem = incomingByRef.get(decision.incomingRef)!
    if (decision.sameAsIncomingRef && incomingByRef.has(decision.sameAsIncomingRef)) {
      const other = incomingByRef.get(decision.sameAsIncomingRef)!
      if (other.entity.nodeType !== incomingItem.entity.nodeType) continue
      union(decision.incomingRef, decision.sameAsIncomingRef)
    }
  }
  for (const decision of decisions) {
    if (!incomingByRef.has(decision.incomingRef) || !decision.existingRef) continue
    const incomingItem = incomingByRef.get(decision.incomingRef)!
    const target = existingByRef.get(decision.existingRef)
    if (!target) continue
    if (target.nodeType && target.nodeType !== incomingItem.entity.nodeType) continue
    existingRoot.set(find(decision.incomingRef), target)
  }

  const clusters = new Map<string, Array<{ key: string; entity: AlignableEntity; ref: string }>>()
  for (const [ref, item] of incomingByRef) {
    const root = find(ref)
    const list = clusters.get(root) ?? []
    list.push({ ...item, ref })
    clusters.set(root, list)
  }

  for (const [root, cluster] of clusters) {
    const existingHit = existingRoot.get(root) ?? existingRoot.get(find(root))
    const aliases = mergeAliasList(
      existingHit?.aliases ?? [],
      cluster.flatMap((c) => [c.entity.name, ...(c.entity.aliases ?? [])])
    )
    const canonical = cluster.reduce((best, item) =>
      (item.entity.summary || '').length > (best.entity.summary || '').length ? item : best
    )
    const aligned: AlignedEntity = existingHit
      ? {
          key: canonical.key,
          id: existingHit.id,
          canonicalName: existingHit.name,
          aliases,
          summary: canonical.entity.summary || existingHit.summary || '',
          reused: true,
          mergedBy: 'llm'
        }
      : {
          key: canonical.key,
          id: lookup.nodeIdForEntity(canonical.entity.nodeType, canonical.entity.name),
          canonicalName: canonical.entity.name,
          aliases,
          summary: canonical.entity.summary || '',
          reused: false,
          mergedBy: cluster.length > 1 ? 'llm' : 'create'
        }
    for (const item of cluster) {
      out.set(item.key, { ...aligned, key: item.key })
    }
  }
  return true
}

function assignCreate(
  item: { key: string; entity: AlignableEntity },
  lookup: EntityAlignLookup,
  out: Map<string, AlignedEntity>
) {
  out.set(item.key, {
    key: item.key,
    id: lookup.nodeIdForEntity(item.entity.nodeType, item.entity.name),
    canonicalName: item.entity.name,
    aliases: mergeAliasList([], [item.entity.name, ...(item.entity.aliases ?? [])]),
    summary: item.entity.summary ?? '',
    reused: false,
    mergedBy: 'create'
  })
}

function shouldRecallAlignCandidate(distance: number): boolean {
  return graphCosineDistanceToSimilarity(distance) > CANDIDATE_MIN_SIMILARITY
}
