import {
  notebookGraphEdgeId,
  notebookGraphExtractStateId,
  notebookGraphNodeIdForEntity,
  notebookGraphSourceNodeId,
  graphReviewStatusFromConfidence,
  normalizeGraphExtractConfidence,
  normalizeGraphName,
  type NotebookGraphEdgeRawRecord,
  type NotebookGraphExtractStateRawRecord,
  type NotebookGraphNodeRawRecord
} from '@baishou/shared'
import { GRAPH_EDGE_TYPES, GRAPH_NODE_TYPES, type NotebookGraphExtractStore } from '@baishou/database/shared'
import { logger } from '@baishou/shared'
import { extractFirstJsonObject } from '../graph/graph-llm-extraction.service'
import type { NotebookGraphExtractRaw } from './notebook-graph-extract-raw'
import type { NotebookGraphIndexService } from './notebook-graph-index.service'
import { notebookGraphDeletedShardPaths } from '../raw-data/notebook-graph-shard-key.util'
import { splitKnowledgeGraphWindows } from './knowledge-graph-windows.util'

export type KnowledgeGraphExtractInput = {
  vaultId: string
  notebookId: string
  sourceId: string
  sourceTitle: string
  text: string
  textHash: string
  pages?: Array<{ page: number; start: number; end: number }> | null
  force?: boolean
  onProgress?: (progress: { windowsDone: number; windowsTotal: number }) => void | Promise<void>
}

const NODE_TYPE_SET = new Set<string>([...GRAPH_NODE_TYPES, 'source'])
const EDGE_TYPE_SET = new Set<string>(GRAPH_EDGE_TYPES)

export interface KnowledgeGraphExtractLlm {
  (input: { system: string; user: string }): Promise<string | null>
}

export class KnowledgeGraphExtractionService {
  constructor(
    private readonly deps: {
      raw: NotebookGraphExtractRaw
      repo: NotebookGraphExtractStore
      index: Pick<NotebookGraphIndexService, 'syncPendingIndex'>
      llm: KnowledgeGraphExtractLlm
      getVaultName: () => string
    }
  ) {}

  async extractSource(
    input: KnowledgeGraphExtractInput
  ): Promise<{ windows: number; truncated: boolean; skipped?: string }> {
    const vaultId = input.vaultId.trim()
    const notebookId = input.notebookId.trim()
    if (!vaultId || !notebookId) throw new Error('extractSource: vaultId and notebookId required')

    if (input.force) {
      if (this.deps.raw.deleteSourceShards) {
        await this.deps.raw.deleteSourceShards(notebookId, input.sourceId)
      }
      await this.deps.index.syncPendingIndex({
        vaultId,
        notebookId,
        deletedShardPaths: notebookGraphDeletedShardPaths(notebookId, input.sourceId)
      })
    }

    const existing = input.force
      ? null
      : await this.deps.raw.getExtractState(notebookId, input.sourceId)
    if (
      existing &&
      existing.extractedTextHash === input.textHash &&
      existing.windowsDone >= existing.windowsTotal &&
      existing.windowsTotal > 0
    ) {
      return { windows: existing.windowsDone, truncated: Boolean(existing.truncated), skipped: 'unchanged' }
    }

    const { windows, truncated } = splitKnowledgeGraphWindows(
      input.text,
      input.sourceId,
      input.pages
    )
    await input.onProgress?.({ windowsDone: 0, windowsTotal: windows.length })
    const vaultName = this.deps.getVaultName()
    const now = Date.now()
    const shardKey = input.sourceId.trim()
    const exceptIds = new Set<string>()
    const nameToIds = new Map<string, Map<string, string>>()
    const writtenNodes = new Map<string, NotebookGraphNodeRawRecord>()
    const writtenEdges = new Map<string, NotebookGraphEdgeRawRecord>()

    const sourceNode = this.buildSourceNode({
      vaultId,
      vaultName,
      notebookId,
      sourceId: input.sourceId,
      title: input.sourceTitle,
      shardMonth: shardKey,
      now
    })
    writtenNodes.set(sourceNode.id, sourceNode)
    registerTypedName(nameToIds, 'source', input.sourceId, sourceNode.id)
    if (input.sourceTitle.trim()) {
      registerTypedName(nameToIds, 'source', input.sourceTitle, sourceNode.id)
    }

    let done = 0
    for (const win of windows) {
      const payload = await this.extractWindow(win.text)
      if (!payload) continue
      for (const ent of payload.entities) {
        const name = String(ent.name || '').trim()
        if (!name) continue
        const nodeType = clampNodeType(String(ent.type || 'topic'))
        if (nodeType === 'source' || nodeType === 'entry') continue
        const incomingAliases = Array.isArray(ent.aliases)
          ? ent.aliases.filter((a): a is string => typeof a === 'string')
          : []
        const existingId =
          resolveTypedName(nameToIds, name, nodeType) ||
          (await this.lookupId(vaultId, notebookId, name, nodeType))
        const prior = existingId ? writtenNodes.get(existingId) : undefined
        const priorRow =
          !prior && existingId
            ? await this.deps.repo.findNodeByName(vaultId, notebookId, name, nodeType)
            : null
        const id = existingId ?? notebookGraphNodeIdForEntity(vaultId, notebookId, nodeType, name)
        const confidence = normalizeGraphExtractConfidence(ent.confidence, 80)
        const firstSeenAt = Math.min(prior?.firstSeenAt ?? priorRow?.firstSeenAt ?? now, now)
        const record: NotebookGraphNodeRawRecord = {
          id,
          schemaVersion: 1,
          vaultId,
          vaultName,
          notebookId,
          nodeType,
          name: prior?.name ?? priorRow?.name ?? name,
          aliases: mergeAliasList(prior?.aliases ?? parseRowAliases(priorRow?.aliases), [
            name,
            ...incomingAliases
          ]),
          summary:
            typeof ent.summary === 'string' && ent.summary.trim()
              ? ent.summary
              : (prior?.summary ?? priorRow?.summary ?? ''),
          props: prior?.props ?? {},
          mentionCount: (prior?.mentionCount ?? priorRow?.mentionCount ?? 0) + 1,
          firstSeenAt,
          lastSeenAt: now,
          origin: 'ai',
          shardMonth: shardKey,
          createdAt: prior?.createdAt ?? priorRow?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          reviewStatus: preferNotebookReviewStatus(
            prior?.reviewStatus ?? priorRow?.reviewStatus,
            graphReviewStatusFromConfidence(confidence)
          )
        }
        writtenNodes.set(id, record)
        registerTypedName(nameToIds, nodeType, name, id)
        for (const alias of record.aliases) registerTypedName(nameToIds, nodeType, alias, id)
      }

      for (const edge of payload.edges) {
        const fromName = String(edge.from || '').trim()
        const toName = String(edge.to || '').trim()
        if (!fromName || !toName) continue
        const fromId =
          resolveTypedName(nameToIds, fromName) ||
          (await this.lookupId(vaultId, notebookId, fromName))
        const toId =
          resolveTypedName(nameToIds, toName) ||
          (await this.lookupId(vaultId, notebookId, toName))
        if (!fromId || !toId) continue
        const edgeType = clampEdgeType(String(edge.type || 'relates_to'))
        const confidence = normalizeGraphExtractConfidence(edge.confidence, 75)
        const record: NotebookGraphEdgeRawRecord = {
          id: notebookGraphEdgeId(vaultId, notebookId, fromId, toId, edgeType, win.sourceRef),
          schemaVersion: 1,
          vaultId,
          vaultName,
          notebookId,
          fromId,
          toId,
          edgeType,
          props: {},
          validFrom: now,
          validTo: null,
          isCurrent: true,
          sourceKind: 'knowledge',
          sourceRef: win.sourceRef,
          sourceExcerpt: typeof edge.excerpt === 'string' ? edge.excerpt : '',
          sourceContentHash: input.textHash,
          confidence,
          origin: 'ai',
          reviewStatus: graphReviewStatusFromConfidence(confidence),
          shardMonth: shardKey,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        }
        exceptIds.add(record.id)
        writtenEdges.set(record.id, record)
      }
      done += 1
      await this.deps.raw.replaceSourceGraph({
        notebookId,
        sourceId: input.sourceId,
        nodes: [...writtenNodes.values()],
        edges: [...writtenEdges.values()],
        extractState: this.buildExtractState({
          vaultId,
          vaultName,
          notebookId,
          sourceId: input.sourceId,
          textHash: input.textHash,
          windowsDone: done,
          windowsTotal: windows.length,
          truncated,
          now
        })
      })
      await input.onProgress?.({ windowsDone: done, windowsTotal: windows.length })
    }

    if (done === 0 && windows.length > 0) {
      await this.deps.raw.replaceSourceGraph({
        notebookId,
        sourceId: input.sourceId,
        nodes: [...writtenNodes.values()],
        edges: [...writtenEdges.values()],
        extractState: this.buildExtractState({
          vaultId,
          vaultName,
          notebookId,
          sourceId: input.sourceId,
          textHash: input.textHash,
          windowsDone: windows.length,
          windowsTotal: windows.length,
          truncated,
          now
        })
      })
      await input.onProgress?.({ windowsDone: windows.length, windowsTotal: windows.length })
    }

    if (shouldSupersedeNotebookAiEdges(exceptIds)) {
      await this.deps.repo.supersedeAiEdgesBySourcePrefix({
        notebookId,
        sourceRefPrefix: input.sourceId,
        exceptIds
      })
    }
    await this.deps.index.syncPendingIndex({ vaultId, notebookId })
    logger.info('[KnowledgeGraphExtract] done', {
      sourceId: input.sourceId,
      windows: done,
      truncated
    })
    return { windows: done, truncated }
  }

  private async lookupId(
    vaultId: string,
    notebookId: string,
    name: string,
    nodeType?: string
  ): Promise<string | null> {
    const row = await this.deps.repo.findNodeByName(vaultId, notebookId, name, nodeType)
    return row?.id ?? null
  }

  private buildSourceNode(input: {
    vaultId: string
    vaultName: string
    notebookId: string
    sourceId: string
    title: string
    shardMonth: string
    now: number
  }): NotebookGraphNodeRawRecord {
    return {
      id: notebookGraphSourceNodeId(input.vaultId, input.notebookId, input.sourceId),
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      notebookId: input.notebookId,
      nodeType: 'source',
      name: input.title || input.sourceId,
      aliases: [input.sourceId],
      summary: '',
      props: { sourceId: input.sourceId },
      mentionCount: 1,
      firstSeenAt: input.now,
      lastSeenAt: input.now,
      origin: 'ai',
      shardMonth: input.shardMonth,
      createdAt: input.now,
      updatedAt: input.now,
      deletedAt: null,
      reviewStatus: 'approved'
    }
  }

  private buildExtractState(input: {
    vaultId: string
    vaultName: string
    notebookId: string
    sourceId: string
    textHash: string
    windowsDone: number
    windowsTotal: number
    truncated: boolean
    now: number
  }): NotebookGraphExtractStateRawRecord {
    return {
      id: notebookGraphExtractStateId(input.notebookId, input.sourceId),
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      notebookId: input.notebookId,
      sourceId: input.sourceId,
      extractedTextHash: input.textHash,
      windowsDone: input.windowsDone,
      windowsTotal: input.windowsTotal,
      truncated: input.truncated,
      extractedAt: input.now,
      updatedAt: input.now,
      deletedAt: null
    }
  }

  private async extractWindow(text: string): Promise<{
    entities: Array<{ name?: string; type?: string; aliases?: string[]; summary?: string; confidence?: number }>
    edges: Array<{ from?: string; to?: string; type?: string; excerpt?: string; confidence?: number }>
  } | null> {
    const raw = await this.deps.llm({
      system:
        '你从资料片段抽取实体和关系。只输出 JSON：{"entities":[{"name","type","aliases","summary","confidence"}],"edges":[{"from","to","type","excerpt","confidence"}]}。type 只能是 person/place/organization/event/emotion/topic/work/activity/product/food。edge type 只能是 mentions/participates_in/located_at/evokes/role_of/relates_to。confidence 用 0 到 100 的整数，不要用 0 到 1。不要编造资料中没有的内容。',
      user: text.slice(0, 8000)
    })
    return parseExtractJson(raw)
  }
}

/** 抽空 / 全窗解析失败时不得退役旧 AI 边 */
export function shouldSupersedeNotebookAiEdges(keptEdgeIds: ReadonlySet<string>): boolean {
  return keptEdgeIds.size > 0
}

function preferNotebookReviewStatus(
  existing: string | null | undefined,
  incoming: 'approved' | 'pending'
): 'approved' | 'pending' | 'rejected' {
  if (existing === 'approved') return 'approved'
  if (existing === 'rejected') return 'rejected'
  return incoming
}

function registerTypedName(
  map: Map<string, Map<string, string>>,
  nodeType: string,
  name: string,
  id: string
): void {
  const norm = normalizeGraphName(name)
  if (!norm) return
  let byType = map.get(norm)
  if (!byType) {
    byType = new Map()
    map.set(norm, byType)
  }
  byType.set(nodeType.trim().toLowerCase() || 'topic', id)
}

function resolveTypedName(
  map: Map<string, Map<string, string>>,
  name: string,
  nodeType?: string
): string | undefined {
  const byType = map.get(normalizeGraphName(name))
  if (!byType || byType.size === 0) return undefined
  if (nodeType) return byType.get(nodeType.trim().toLowerCase())
  if (byType.size === 1) return [...byType.values()][0]
  return undefined
}

function clampNodeType(value: string): string {
  const t = value.trim().toLowerCase()
  return NODE_TYPE_SET.has(t) ? t : 'topic'
}

function clampEdgeType(value: string): string {
  const t = value.trim().toLowerCase()
  return EDGE_TYPE_SET.has(t) ? t : 'relates_to'
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

function parseRowAliases(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string')
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function parseExtractJson(text: string | null): {
  entities: Array<{ name?: string; type?: string; aliases?: string[]; summary?: string; confidence?: number }>
  edges: Array<{ from?: string; to?: string; type?: string; excerpt?: string; confidence?: number }>
} | null {
  if (!text?.trim()) return null
  const json = extractFirstJsonObject(text)
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as {
      entities?: unknown
      edges?: unknown
    }
    return {
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : []
    }
  } catch {
    return null
  }
}
