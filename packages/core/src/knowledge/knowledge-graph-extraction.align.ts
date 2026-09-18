import {
  appendAmbiguousSourceRef,
  applyAlignedSimilarPendingToProps,
  entityAlignKey,
  notebookGraphEdgeId,
  notebookGraphNodeIdForEntity,
  graphReviewStatusFromConfidence,
  normalizeGraphExtractConfidence,
  type NotebookGraphEdgeRawRecord,
  type NotebookGraphExtractedWindowPayload,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import type {
  NotebookGraphEmbedding,
  NotebookGraphExtractStore,
  NotebookGraphQuery
} from '@baishou/database/shared'
import { logger } from '@baishou/shared'
import {
  alignEntityPool,
  alignedEmbeddingForNodeCard,
  buildEntityAlignPrompt,
  buildNameCandidateJudgePrompt,
  parseEntityAlignJudgeOutput,
  parseNameCandidateDecision,
  type AlignedEntity,
  type AlignedEntityHit,
  type EntityAlignLookup
} from '../graph/graph-entity-align'
import { refreshNotebookEmbeddingsAfterAlign } from './knowledge-graph-extraction.embed-refresh'
import type {
  KnowledgeGraphExtractAlignDeps,
  KnowledgeGraphExtractLlm
} from './knowledge-graph-extraction.helpers'
import {
  clampEdgeType,
  clampNodeType,
  mergeAliasList,
  parseRowAliases,
  parseRowProps,
  preferNotebookReviewStatus,
  registerTypedName,
  resolveTypedName,
  reviewStatusForAmbiguousEndpoint
} from './knowledge-graph-extraction.helpers'

function applyAlignedProps(
  base: Record<string, unknown>,
  input: {
    ambiguous: boolean
    sourceRef: string
    similarPending?: AlignedEntity['similarPending']
  }
): Record<string, unknown> {
  let props = input.ambiguous ? appendAmbiguousSourceRef(base, input.sourceRef) : { ...base }
  if (input.similarPending) {
    props = applyAlignedSimilarPendingToProps(props, {
      reused: false,
      similarPending: input.similarPending
    })
  }
  return props
}

export type KnowledgeGraphAlignDeps = {
  repo: NotebookGraphExtractStore &
    Partial<NotebookGraphEmbedding> &
    Pick<NotebookGraphQuery, 'findNodesByNameOrAlias'>
  llm: KnowledgeGraphExtractLlm
  align?: KnowledgeGraphExtractAlignDeps | null
}

export function buildAlignLookup(
  deps: KnowledgeGraphAlignDeps,
  vaultId: string,
  notebookId: string,
  nameToIds: Map<string, Map<string, string>>,
  writtenNodes: Map<string, NotebookGraphNodeRawRecord>
): EntityAlignLookup {
  const sessionHit = (name: string, type: string): AlignedEntityHit | null => {
    const id = resolveTypedName(nameToIds, name, type)
    if (!id) return null
    const rec = writtenNodes.get(id)
    if (!rec) return null
    return {
      id: rec.id,
      name: rec.name,
      aliases: rec.aliases,
      summary: rec.summary,
      discriminator: rec.discriminator
    }
  }
  return {
    findCandidatesByNameOrAlias: async (name, type) => {
      const rows = await deps.repo.findNodesByNameOrAlias(vaultId, notebookId, name, type)
      if (rows.length > 0) {
        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          aliases: parseRowAliases(row.aliases),
          summary: row.summary ?? '',
          discriminator: row.discriminator ?? undefined
        }))
      }
      const fromSession = sessionHit(name, type)
      return fromSession ? [fromSession] : []
    },
    searchByVector:
      deps.align?.embedQuery && deps.repo.searchNodesByVector
        ? async (vector, type, topK) => {
            const hits = await deps.repo.searchNodesByVector!(
              vaultId,
              notebookId,
              vector,
              topK ?? 5,
              { nodeType: type, modelId: deps.align?.modelId }
            )
            return hits.map((hit) => ({
              id: hit.id,
              name: hit.name,
              aliases: parseRowAliases(hit.aliases),
              summary: hit.summary ?? '',
              nodeType: hit.nodeType,
              distance: hit.distance
            }))
          }
        : undefined,
    embedQuery: deps.align?.embedQuery,
    nodeIdForEntity: (type, name) => notebookGraphNodeIdForEntity(vaultId, notebookId, type, name),
    judgeMerges: async (input) => {
      const prompt = buildEntityAlignPrompt(input)
      const text = await deps.llm(prompt)
      return parseEntityAlignJudgeOutput(text)
    },
    judgeNameCandidates: async (input) => {
      const prompt = buildNameCandidateJudgePrompt(input)
      const text = await deps.llm(prompt)
      return parseNameCandidateDecision(text)
    }
  }
}

async function lookupPriorRow(
  deps: KnowledgeGraphAlignDeps,
  vaultId: string,
  notebookId: string,
  hit: AlignedEntity | undefined,
  name: string,
  nodeType: string
) {
  const rows = await deps.repo.findNodesByNameOrAlias(
    vaultId,
    notebookId,
    hit?.canonicalName || name,
    nodeType
  )
  if (hit?.id) {
    return rows.find((row) => row.id === hit.id) ?? rows[0] ?? null
  }
  return rows[0] ?? null
}

function rememberAmbiguousBareNode(
  input: {
    vaultId: string
    notebookId: string
    vaultName: string
    writtenNodes: Map<string, NotebookGraphNodeRawRecord>
    sourceRef: string
    shardMonth: string
    now: number
  },
  row: {
    id: string
    nodeType: string
    name: string
    discriminator?: string | null
    aliases: string | string[] | null
    summary: string | null
    propsJson?: string | null
    mentionCount: number | null
    firstSeenAt: number | null
    lastSeenAt: number | null
    createdAt: number
    reviewStatus?: string | null
  }
): void {
  const prior = input.writtenNodes.get(row.id)
  if (prior) {
    prior.props = appendAmbiguousSourceRef(prior.props, input.sourceRef)
    prior.updatedAt = input.now
    return
  }
  input.writtenNodes.set(row.id, {
    id: row.id,
    schemaVersion: 1,
    vaultId: input.vaultId,
    vaultName: input.vaultName,
    notebookId: input.notebookId,
    nodeType: row.nodeType,
    name: row.name,
    discriminator: row.discriminator ?? undefined,
    aliases: parseRowAliases(row.aliases),
    summary: row.summary ?? '',
    props: appendAmbiguousSourceRef(parseRowProps(row), input.sourceRef),
    mentionCount: row.mentionCount ?? 0,
    firstSeenAt: row.firstSeenAt ?? input.now,
    lastSeenAt: row.lastSeenAt ?? input.now,
    origin: 'ai',
    shardMonth: input.shardMonth,
    createdAt: row.createdAt,
    updatedAt: input.now,
    deletedAt: null,
    reviewStatus: preferNotebookReviewStatus(row.reviewStatus, 'approved')
  })
}

async function lookupEndpoint(
  deps: KnowledgeGraphAlignDeps,
  input: {
    vaultId: string
    notebookId: string
    vaultName: string
    name: string
    nameToIds: Map<string, Map<string, string>>
    writtenNodes: Map<string, NotebookGraphNodeRawRecord>
    ambiguousNodeIds: Set<string>
    sourceRef: string
    shardMonth: string
    now: number
  }
): Promise<{ id: string; ambiguous: boolean } | null> {
  const sessionId = resolveTypedName(input.nameToIds, input.name)
  if (sessionId) {
    return { id: sessionId, ambiguous: input.ambiguousNodeIds.has(sessionId) }
  }
  const rows = await deps.repo.findNodesByNameOrAlias(input.vaultId, input.notebookId, input.name)
  if (rows.length === 0) return null
  const first = rows[0]!
  const ambiguous = rows.length > 1
  if (ambiguous) {
    input.ambiguousNodeIds.add(first.id)
    rememberAmbiguousBareNode(input, first)
  }
  return { id: first.id, ambiguous }
}

export async function writeAlignedEmbeddings(
  deps: KnowledgeGraphAlignDeps,
  vaultId: string,
  notebookId: string,
  embeddings: Map<string, number[]>
): Promise<void> {
  const modelId = deps.align?.modelId?.trim()
  const update = deps.repo.updateNodeEmbedding
  if (!modelId || !update || embeddings.size === 0) return
  for (const [id, embedding] of embeddings) {
    try {
      await update(id, vaultId, notebookId, embedding, modelId)
    } catch (error) {
      logger.warn('[KnowledgeGraphExtract] updateNodeEmbedding failed', error as Error)
    }
  }
}

/**
 * 全部窗口抽完后再对齐一次。本批实体都在内存里，不依赖上一窗是否已经进 SQLite。
 */
export async function commitAlignedWindows(
  deps: KnowledgeGraphAlignDeps,
  input: {
    vaultId: string
    vaultName: string
    notebookId: string
    sourceId: string
    textHash: string
    shardKey: string
    now: number
    sourceNode: NotebookGraphNodeRawRecord
    extractedWindows: NotebookGraphExtractedWindowPayload[]
  }
): Promise<{
  nodes: NotebookGraphNodeRawRecord[]
  edges: NotebookGraphEdgeRawRecord[]
  exceptIds: Set<string>
  pendingEmbeddings: Map<string, number[]>
}> {
  const exceptIds = new Set<string>()
  const nameToIds = new Map<string, Map<string, string>>()
  const writtenNodes = new Map<string, NotebookGraphNodeRawRecord>()
  const writtenEdges = new Map<string, NotebookGraphEdgeRawRecord>()
  const pendingEmbeddings = new Map<string, number[]>()
  const ambiguousNodeIds = new Set<string>()

  writtenNodes.set(input.sourceNode.id, input.sourceNode)
  registerTypedName(nameToIds, 'source', input.sourceId, input.sourceNode.id)
  if (input.sourceNode.name.trim()) {
    registerTypedName(nameToIds, 'source', input.sourceNode.name, input.sourceNode.id)
  }

  const poolEntities: Array<{
    name: string
    nodeType: string
    incomingAliases: string[]
    summary: string
    confidence: number
    sourceRef: string
    sourceContext?: string
  }> = []
  for (const win of input.extractedWindows) {
    for (const ent of win.entities) {
      const name = String(ent.name || '').trim()
      if (!name) continue
      const nodeType = clampNodeType(String(ent.type || 'topic'))
      if (nodeType === 'source' || nodeType === 'entry') continue
      const incomingAliases = Array.isArray(ent.aliases)
        ? ent.aliases.filter((a): a is string => typeof a === 'string')
        : []
      poolEntities.push({
        name,
        nodeType,
        incomingAliases,
        summary: typeof ent.summary === 'string' ? ent.summary : '',
        confidence: normalizeGraphExtractConfidence(ent.confidence, 80),
        sourceRef: win.sourceRef,
        sourceContext: win.sourceContext
      })
    }
  }

  const aligned = await alignEntityPool(
    poolEntities.map((ent) => ({
      name: ent.name,
      nodeType: ent.nodeType,
      aliases: ent.incomingAliases,
      summary: ent.summary,
      sourceContext: ent.sourceContext
    })),
    buildAlignLookup(deps, input.vaultId, input.notebookId, nameToIds, writtenNodes)
  )

  for (const ent of poolEntities) {
    const hit = aligned.get(entityAlignKey(ent.nodeType, ent.name))
    const existingId = hit?.id || resolveTypedName(nameToIds, ent.name, ent.nodeType)
    const prior = existingId ? writtenNodes.get(existingId) : undefined
    const priorRow =
      !prior && existingId
        ? await lookupPriorRow(deps, input.vaultId, input.notebookId, hit, ent.name, ent.nodeType)
        : null
    const id =
      existingId ??
      notebookGraphNodeIdForEntity(input.vaultId, input.notebookId, ent.nodeType, ent.name)
    const firstSeenAt = Math.min(
      prior?.firstSeenAt ?? priorRow?.firstSeenAt ?? input.now,
      input.now
    )
    const baseProps = prior?.props ?? parseRowProps(priorRow)
    const ambiguous = hit?.ambiguous === true
    if (ambiguous) ambiguousNodeIds.add(id)
    const record: NotebookGraphNodeRawRecord = {
      id,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      notebookId: input.notebookId,
      nodeType: ent.nodeType,
      name: prior?.name ?? priorRow?.name ?? hit?.canonicalName ?? ent.name,
      discriminator: prior?.discriminator ?? priorRow?.discriminator,
      aliases: mergeAliasList(prior?.aliases ?? parseRowAliases(priorRow?.aliases), [
        ent.name,
        ...ent.incomingAliases,
        ...(hit?.aliases ?? [])
      ]),
      summary: ent.summary.trim()
        ? ent.summary
        : (prior?.summary ?? priorRow?.summary ?? hit?.summary ?? ''),
      props: applyAlignedProps(baseProps, {
        ambiguous,
        sourceRef: ent.sourceRef,
        similarPending: hit?.similarPending
      }),
      mentionCount: (prior?.mentionCount ?? priorRow?.mentionCount ?? 0) + 1,
      firstSeenAt,
      lastSeenAt: input.now,
      origin: 'ai',
      shardMonth: input.shardKey,
      createdAt: prior?.createdAt ?? priorRow?.createdAt ?? input.now,
      updatedAt: input.now,
      deletedAt: null,
      reviewStatus: preferNotebookReviewStatus(
        prior?.reviewStatus ?? priorRow?.reviewStatus,
        graphReviewStatusFromConfidence(ent.confidence)
      )
    }
    writtenNodes.set(id, record)
    registerTypedName(nameToIds, ent.nodeType, ent.name, id)
    if (hit?.canonicalName) registerTypedName(nameToIds, ent.nodeType, hit.canonicalName, id)
    for (const alias of record.aliases) registerTypedName(nameToIds, ent.nodeType, alias, id)
    const reusable = alignedEmbeddingForNodeCard(hit, record.name, record.summary)
    if (reusable && !pendingEmbeddings.has(id)) {
      pendingEmbeddings.set(id, reusable.embedding)
    }
  }

  for (const win of input.extractedWindows) {
    for (const edge of win.edges) {
      const fromName = String(edge.from || '').trim()
      const toName = String(edge.to || '').trim()
      if (!fromName || !toName) continue
      const from = await lookupEndpoint(deps, {
        vaultId: input.vaultId,
        notebookId: input.notebookId,
        vaultName: input.vaultName,
        name: fromName,
        nameToIds,
        writtenNodes,
        ambiguousNodeIds,
        sourceRef: win.sourceRef,
        shardMonth: input.shardKey,
        now: input.now
      })
      const to = await lookupEndpoint(deps, {
        vaultId: input.vaultId,
        notebookId: input.notebookId,
        vaultName: input.vaultName,
        name: toName,
        nameToIds,
        writtenNodes,
        ambiguousNodeIds,
        sourceRef: win.sourceRef,
        shardMonth: input.shardKey,
        now: input.now
      })
      if (!from || !to) continue
      const edgeType = clampEdgeType(String(edge.type || 'relates_to'))
      const confidence = normalizeGraphExtractConfidence(edge.confidence, 75)
      const record: NotebookGraphEdgeRawRecord = {
        id: notebookGraphEdgeId(
          input.vaultId,
          input.notebookId,
          from.id,
          to.id,
          edgeType,
          win.sourceRef
        ),
        schemaVersion: 1,
        vaultId: input.vaultId,
        vaultName: input.vaultName,
        notebookId: input.notebookId,
        fromId: from.id,
        toId: to.id,
        edgeType,
        props: {},
        validFrom: input.now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'knowledge',
        sourceRef: win.sourceRef,
        sourceExcerpt: typeof edge.excerpt === 'string' ? edge.excerpt : '',
        sourceContentHash: input.textHash,
        confidence,
        origin: 'ai',
        reviewStatus: reviewStatusForAmbiguousEndpoint(
          graphReviewStatusFromConfidence(confidence),
          from.ambiguous || to.ambiguous
        ),
        shardMonth: input.shardKey,
        createdAt: input.now,
        updatedAt: input.now,
        deletedAt: null
      }
      exceptIds.add(record.id)
      writtenEdges.set(record.id, record)
    }
  }

  await refreshNotebookEmbeddingsAfterAlign(deps, {
    vaultId: input.vaultId,
    notebookId: input.notebookId,
    nodes: writtenNodes.values(),
    pendingEmbeddings
  })

  return {
    nodes: [...writtenNodes.values()],
    edges: [...writtenEdges.values()],
    exceptIds,
    pendingEmbeddings
  }
}
