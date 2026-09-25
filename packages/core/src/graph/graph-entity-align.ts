import {
  entityAlignKey,
  graphCosineDistanceToSimilarity,
  meetsGraphSimilarPendingThreshold
} from '@baishou/shared'
import {
  type AlignableEntity,
  type AlignedEntity,
  type AlignedEntityHit,
  type EntityAlignJudgeExisting,
  type EntityAlignJudgeIncoming,
  type EntityAlignJudgeDecision,
  type EntityAlignJudgeOutput,
  type EntityAlignLookup,
  clipNameCandidateSourceContext,
  embedText,
  mergeAliasList
} from './graph-entity-align.types'

export * from './graph-entity-align.types'
export {
  buildEntityAlignPrompt,
  buildNameCandidateJudgePrompt,
  parseEntityAlignDecisions,
  parseEntityAlignJudgeOutput,
  parseNameCandidateDecision
} from './graph-entity-align.prompt'

const VECTOR_CANDIDATE_TOP_K = 5

function uniqueEntities(entities: AlignableEntity[]): Map<string, AlignableEntity> {
  const unique = new Map<string, AlignableEntity>()
  for (const raw of entities) {
    const name = String(raw.name || '').trim()
    if (!name) continue
    const nodeType =
      String(raw.nodeType || 'topic')
        .trim()
        .toLowerCase() || 'topic'
    const key = entityAlignKey(nodeType, name)
    const prev = unique.get(key)
    if (!prev) {
      unique.set(key, {
        name,
        nodeType,
        aliases: raw.aliases ?? [],
        summary: raw.summary ?? '',
        sourceContext: raw.sourceContext
      })
      continue
    }
    unique.set(key, {
      name: prev.name,
      nodeType,
      aliases: mergeAliasList(prev.aliases ?? [], [name, ...(raw.aliases ?? [])]),
      summary: prev.summary || raw.summary || '',
      sourceContext: prev.sourceContext || raw.sourceContext
    })
  }
  return unique
}

function reuseNameHit(
  key: string,
  entity: AlignableEntity,
  hit: AlignedEntityHit,
  mergedBy: 'name' | 'llm',
  ambiguous: boolean
): AlignedEntity {
  return {
    key,
    id: hit.id,
    canonicalName: hit.name,
    aliases: mergeAliasList(hit.aliases, [entity.name, ...(entity.aliases ?? [])]),
    summary: entity.summary || hit.summary || '',
    reused: true,
    mergedBy,
    ambiguous
  }
}

async function pickNameCandidate(
  entity: AlignableEntity,
  hits: AlignedEntityHit[],
  lookup: EntityAlignLookup
): Promise<AlignedEntityHit | null> {
  if (!lookup.judgeNameCandidates) return null
  const allowed = new Set(hits.map((hit) => hit.id))
  try {
    const picked = await lookup.judgeNameCandidates({
      incoming: {
        name: entity.name,
        nodeType: entity.nodeType,
        aliases: entity.aliases ?? [],
        summary: entity.summary ?? ''
      },
      candidates: hits.map((hit) => ({
        id: hit.id,
        name: hit.name,
        discriminator: hit.discriminator,
        aliases: hit.aliases,
        summary: hit.summary ?? ''
      })),
      sourceContext: entity.sourceContext
    })
    if (!picked || !allowed.has(picked)) return null
    return hits.find((hit) => hit.id === picked) ?? null
  } catch {
    return null
  }
}

/**
 * 名字/别名等值先复用；同名多条时若配置了 judgeNameCandidates 则只从候选里选。
 * 其余只召回相似度大于 70% 的候选，交给二次 LLM 判断。
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
      hits: await lookup.findCandidatesByNameOrAlias(entity.name, entity.nodeType)
    }))
  )
  for (const { key, entity, hits } of nameHits) {
    if (hits.length === 0) {
      unresolved.push({ key, entity })
      continue
    }
    if (hits.length === 1) {
      const hit = hits[0]!
      out.set(key, reuseNameHit(key, entity, hit, 'name', false))
      continue
    }

    const picked = await pickNameCandidate(entity, hits, lookup)
    if (picked) {
      out.set(key, reuseNameHit(key, entity, picked, 'llm', false))
      continue
    }

    const hit = hits[0]!
    out.set(key, reuseNameHit(key, entity, hit, 'name', true))
  }

  if (unresolved.length === 0) return out

  const vectors = new Map<string, number[]>()
  if (lookup.embedQuery) {
    await Promise.all(
      unresolved.map(async ({ key, entity }) => {
        try {
          const vector = await lookup.embedQuery!(embedText(entity))
          if (vector?.length) vectors.set(key, vector)
        } catch (error) {
          if (lookup.requireEmbedQuery) throw error
        }
      })
    )
  }

  if (lookup.judgeMerges) {
    const judged = await alignWithLlm(unresolved, vectors, lookup, out)
    if (judged) return out
  }

  for (const item of unresolved) {
    if (!out.has(item.key)) assignCreate(item, lookup, out, vectors)
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
    summary: item.entity.summary ?? '',
    sourceContext: clipNameCandidateSourceContext(item.entity.sourceContext)
  }))
  const incomingByRef = new Map(incoming.map((item, index) => [item.ref, unresolved[index]!]))

  const existingById = new Map<string, AlignedEntityHit & { nodeType: string; distance?: number }>()
  const similarityByIncomingExisting = new Map<string, Map<string, number>>()
  if (lookup.searchByVector) {
    const recalled = await Promise.all(
      unresolved.map(async ({ key, entity }) => {
        const vector = vectors.get(key)
        if (!vector) return [] as Array<AlignedEntityHit & { distance: number; nodeType: string }>
        try {
          const hits = await lookup.searchByVector!(vector, entity.nodeType, VECTOR_CANDIDATE_TOP_K)
          const kept = hits.filter(
            (hit) =>
              (!hit.nodeType || hit.nodeType === entity.nodeType) &&
              shouldRecallAlignCandidate(hit.distance)
          )
          const byPeer = new Map<string, number>()
          for (const hit of kept) {
            byPeer.set(hit.id, graphCosineDistanceToSimilarity(hit.distance))
          }
          similarityByIncomingExisting.set(key, byPeer)
          return kept.map((hit) => ({ ...hit, nodeType: entity.nodeType }))
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
    assignCreate(unresolved[0]!, lookup, out, vectors)
    return true
  }

  let judged: EntityAlignJudgeOutput | null = null
  try {
    judged = normalizeJudgeOutput(await lookup.judgeMerges?.({ incoming, existing }))
  } catch {
    judged = null
  }
  if (!judged) return false
  const decisions = judged.merges
  const createdAt = new Date().toISOString()

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
      const uncertain = existingHit
        ? undefined
        : judged.uncertain.find(
            (row) => row.incomingRef === item.ref && existingByRef.has(row.existingRef)
          )
      const peer = uncertain ? existingByRef.get(uncertain.existingRef) : undefined
      const similarity = peer
        ? (similarityByIncomingExisting.get(item.key)?.get(peer.id) ?? 0)
        : 0
      const similarPending =
        peer && uncertain && meetsGraphSimilarPendingThreshold(similarity)
          ? {
              peerId: peer.id,
              similarity,
              reason: (uncertain.reason || '').trim() || '吃不准',
              sourceExcerpt: clipNameCandidateSourceContext(item.entity.sourceContext) || undefined,
              createdAt
            }
          : undefined
      out.set(
        item.key,
        withAlignEmbedding(
          { ...aligned, key: item.key, similarPending },
          item.entity,
          vectors.get(item.key)
        )
      )
    }
  }
  return true
}

function normalizeJudgeOutput(
  raw: EntityAlignJudgeDecision[] | EntityAlignJudgeOutput | null | undefined
): EntityAlignJudgeOutput | null {
  if (raw == null) return null
  if (Array.isArray(raw)) return { merges: raw, uncertain: [] }
  return {
    merges: Array.isArray(raw.merges) ? raw.merges : [],
    uncertain: Array.isArray(raw.uncertain) ? raw.uncertain : []
  }
}

function assignCreate(
  item: { key: string; entity: AlignableEntity },
  lookup: EntityAlignLookup,
  out: Map<string, AlignedEntity>,
  vectors?: Map<string, number[]>
) {
  out.set(
    item.key,
    withAlignEmbedding(
      {
        key: item.key,
        id: lookup.nodeIdForEntity(item.entity.nodeType, item.entity.name),
        canonicalName: item.entity.name,
        aliases: mergeAliasList([], [item.entity.name, ...(item.entity.aliases ?? [])]),
        summary: item.entity.summary ?? '',
        reused: false,
        mergedBy: 'create'
      },
      item.entity,
      vectors?.get(item.key)
    )
  )
}

function withAlignEmbedding(
  aligned: AlignedEntity,
  entity: AlignableEntity,
  vector: number[] | undefined
): AlignedEntity {
  if (!vector?.length) return aligned
  return { ...aligned, embedding: vector, embedText: embedText(entity) }
}

function shouldRecallAlignCandidate(distance: number): boolean {
  return meetsGraphSimilarPendingThreshold(graphCosineDistanceToSimilarity(distance))
}
