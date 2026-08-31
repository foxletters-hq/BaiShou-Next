/**
 * GraphUpsertTool — write people/places/events and relations into the life graph JSONL.
 * Writes take effect immediately (reviewStatus=approved). Exact same-name updates that node;
 * the tool never merges two existing nodes. Edges can be written, updated, or deleted.
 * Gate Ask (or Allow rule) still runs before execute.
 */

import { z } from 'zod'
import type {
  GraphEdgeRawRecord,
  GraphNodeRawRecord,
  ToolRawDataSourceManager
} from '@baishou/shared'
import {
  graphDiaryInstant,
  graphEdgeId,
  graphNodeIdForEntity,
  normalizeGraphExtractConfidence,
  normalizeGraphName,
  preferGraphOrigin
} from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const entityItem = z
  .object({
    name: z.string().describe('Display name of the person, place, event, or topic.'),
    type: z
      .string()
      .optional()
      .describe(
        'Entity type: person, place, organization, event, topic, emotion, work, activity, product, food. Default topic.'
      ),
    aliases: z.array(z.string()).optional(),
    summary: z.string().optional(),
    id: z.string().optional()
  })
  .passthrough()

const edgeItem = z
  .object({
    from: z.string().optional().describe('Source entity name or id.'),
    to: z.string().optional().describe('Target entity name or id.'),
    type: z.string().optional().describe('Relation type, e.g. knows / located_at / participates_in.'),
    excerpt: z.string().optional().describe('Short diary excerpt that supports this edge.'),
    id: z
      .string()
      .optional()
      .describe('Existing edge id from recall_relations when updating or deleting.'),
    action: z
      .enum(['write', 'update', 'delete'])
      .optional()
      .describe(
        'write = new edge (default). update = change an existing edge (needs id). delete = remove an edge (needs id).'
      )
  })
  .passthrough()

const jsonArrayOrList = <T extends z.ZodTypeAny>(item: T, describe: string) =>
  z
    .union([z.array(item), z.string()])
    .optional()
    .describe(describe)

const graphUpsertParams = z.object({
  summary: z
    .string()
    .describe(
      'Short human-readable summary of the graph write proposal shown to the user for confirmation.'
    ),
  entities: jsonArrayOrList(
    entityItem,
    'Entities to upsert. Prefer a JSON array of {name, type, aliases?, summary?}. A JSON array string is also accepted.'
  ),
  edges: jsonArrayOrList(
    edgeItem,
    'Relations to upsert. Prefer a JSON array of {from, to, type, excerpt?}. Names are resolved to existing nodes. A JSON array string is also accepted.'
  ),
  source_ref: z
    .string()
    .optional()
    .describe('Source diary date (YYYY-MM-DD) or memory id this proposal is based on.')
})

function parseJsonArray(raw: string | undefined): unknown[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function asObjectArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return parseJsonArray(raw)
  return []
}

function inferSourceKind(sourceRef: string | undefined): GraphEdgeRawRecord['sourceKind'] {
  if (!sourceRef) return 'manual'
  if (/^\d{4}-\d{2}-\d{2}/.test(sourceRef) || sourceRef.includes('Journals/')) return 'diary'
  if (sourceRef.startsWith('mem_') || sourceRef.includes('memory')) return 'memory'
  return 'session'
}

async function deleteGraphEdgeTogether(
  context: ToolContext,
  rawManager: ToolRawDataSourceManager,
  id: string,
  shardMonth?: string | null
): Promise<void> {
  if (context.deleteGraphRecord) {
    await context.deleteGraphRecord({ kind: 'edge', id })
    return
  }
  await rawManager.tombstone('graph', id, {
    collection: 'edges',
    shardMonth: shardMonth ?? undefined
  })
}

function resolveEdgeAction(obj: Record<string, unknown>): 'write' | 'update' | 'delete' {
  const raw = String(obj.action ?? '').trim().toLowerCase()
  if (raw === 'delete' || raw === 'remove') return 'delete'
  if (raw === 'update' || raw === 'patch') return 'update'
  if (raw === 'write' || raw === 'upsert' || raw === 'create') return 'write'
  if (typeof obj.id === 'string' && obj.id.trim()) return 'update'
  return 'write'
}

export class GraphUpsertTool extends AgentTool<typeof graphUpsertParams> {
  readonly name = 'graph_upsert'

  readonly description =
    'Write people, places, events and relations into the life graph (diary relations, not the notebook graph). ' +
    'Writes take effect immediately and become visible to recall_relations. ' +
    'Pass entities/edges as JSON arrays (not stringified unless you must). ' +
    'If the name and type match an existing node exactly, update that node (summary/aliases). ' +
    'Never merge two existing nodes, even when names look similar — tell the user to merge them on the graph page. ' +
    'If you pass an entity id, update that id only; do not switch it to another node. ' +
    'To change a relation, pass the edge id from recall_relations with action=update (type/excerpt/from/to) or action=delete. ' +
    'Call this when the user asks you to remember or correct a relationship. Requires Gate confirmation. ' +
    'Do not invent sources: include source_ref when the write comes from a diary or memory. ' +
    'Use recall_relations first if you are unsure who or which edge already exists.'

  readonly parameters = graphUpsertParams

  get category(): string {
    return 'memory'
  }

  get icon(): string {
    return 'share-2'
  }

  get displayName(): string {
    return '写入人生关系图'
  }

  async execute(args: z.infer<typeof graphUpsertParams>, context: ToolContext): Promise<string> {
    const summary = args.summary.trim()
    if (!summary) {
      return '请提供 summary，说明拟写入图谱的内容。'
    }

    const rawManager = context.rawDataSourceManager as ToolRawDataSourceManager | undefined
    if (!rawManager) {
      return '原始数据源管理器未就绪，无法落盘图谱提案。请重启应用或检查 Vault。'
    }

    const entityItems = asObjectArray(args.entities)
    const edgeItems = asObjectArray(args.edges)
    if (entityItems.length === 0 && edgeItems.length === 0) {
      return '未写入：entities 与 edges 均为空。请提供至少一个节点或边提案（JSON 数组）。'
    }

    const now = Date.now()
    const sourceRef = args.source_ref?.trim() || null
    const diary = graphDiaryInstant(sourceRef ?? undefined, now)
    const shardMonth = diary.shardMonth
    const validFrom = diary.validFrom ?? now
    const sourceKind = inferSourceKind(sourceRef ?? undefined)
    const nameToId = new Map<string, string>()
    const vaultId = context.vaultId
    const vaultName = context.vaultName
    const reviewStatus = 'approved' as const

    let nodesWritten = 0
    let edgesWritten = 0
    let edgesUpdated = 0
    let edgesDeleted = 0
    let edgesSkipped = 0

    try {
      for (const item of entityItems) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const name = String(obj.name ?? obj.label ?? '').trim()
        if (!name) continue
        const nodeType = String(obj.type ?? obj.nodeType ?? 'topic')
          .trim()
          .toLowerCase()
        if (nodeType === 'entry') continue

        const explicitId = typeof obj.id === 'string' ? obj.id.trim() : ''
        let id: string | null = null
        let reused: {
          name?: string
          nodeType?: string
          aliases?: string[]
          summary?: string
          mentionCount?: number
          firstSeenAt?: number | null
          createdAt?: number
          shardMonth?: string
          origin?: 'ai' | 'user'
        } | null = null
        if (explicitId) {
          const byId = context.graphNodeLookup?.findNodeById
            ? await context.graphNodeLookup.findNodeById(explicitId)
            : null
          id = byId?.id ?? explicitId
          reused = byId
        } else if (context.graphNodeLookup) {
          const hit = await context.graphNodeLookup.findNodeByName({ name, nodeType })
          if (hit) {
            id = hit.id
            reused = hit
          }
        }
        if (!id) {
          id = graphNodeIdForEntity(vaultId, nodeType, name)
        }

        const incomingAliases = Array.isArray(obj.aliases)
          ? obj.aliases.filter((a): a is string => typeof a === 'string')
          : []
        const aliases = [...new Set([...(reused?.aliases ?? []), name, ...incomingAliases])]
        const record: GraphNodeRawRecord = {
          id,
          schemaVersion: 1,
          vaultId,
          vaultName,
          nodeType: reused?.nodeType || nodeType,
          name: reused?.name ?? name,
          aliases,
          summary:
            typeof obj.summary === 'string' && obj.summary.trim()
              ? obj.summary
              : (reused?.summary ?? ''),
          props:
            obj.attrs && typeof obj.attrs === 'object'
              ? (obj.attrs as Record<string, unknown>)
              : obj.props && typeof obj.props === 'object'
                ? (obj.props as Record<string, unknown>)
                : {},
          mentionCount: reused?.mentionCount ?? 0,
          firstSeenAt: reused?.firstSeenAt ?? now,
          lastSeenAt: now,
          origin: preferGraphOrigin(reused?.origin, 'ai'),
          shardMonth: reused?.shardMonth || shardMonth,
          createdAt: reused?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          reviewStatus
        }
        await rawManager.writeRecord('graph', record, { collection: 'nodes' })
        nameToId.set(normalizeGraphName(name), id)
        if (obj.id && typeof obj.id === 'string') nameToId.set(normalizeGraphName(obj.id), id)
        nodesWritten += 1
      }

      const resolveEnd = async (raw: string): Promise<string | null> => {
        const key = normalizeGraphName(raw)
        if (!key) return null
        if (nameToId.has(key)) return nameToId.get(key)!
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(raw)) return raw
        if (context.graphNodeLookup) {
          const byId = context.graphNodeLookup.findNodeById
            ? await context.graphNodeLookup.findNodeById(raw)
            : null
          if (byId) {
            nameToId.set(key, byId.id)
            return byId.id
          }
          const hit = await context.graphNodeLookup.findNodeByName({ name: raw })
          if (hit) {
            nameToId.set(key, hit.id)
            return hit.id
          }
        }
        return null
      }

      for (const item of edgeItems) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const action = resolveEdgeAction(obj)
        const existingId = typeof obj.id === 'string' ? obj.id.trim() : ''

        if (action === 'delete') {
          if (!existingId) {
            edgesSkipped += 1
            continue
          }
          const existing = context.graphEdgeLookup
            ? await context.graphEdgeLookup.findEdgeById(existingId)
            : null
          try {
            await deleteGraphEdgeTogether(context, rawManager, existingId, existing?.shardMonth)
            edgesDeleted += 1
          } catch {
            edgesSkipped += 1
          }
          continue
        }

        const existing =
          action === 'update' && existingId && context.graphEdgeLookup
            ? await context.graphEdgeLookup.findEdgeById(existingId)
            : null
        if (action === 'update' && existingId && !existing) {
          edgesSkipped += 1
          continue
        }

        const fromRaw = String(obj.from ?? obj.fromId ?? existing?.fromId ?? '').trim()
        const toRaw = String(obj.to ?? obj.toId ?? existing?.toId ?? '').trim()
        const fromId = await resolveEnd(fromRaw)
        const toId = await resolveEnd(toRaw)
        if (!fromId || !toId) {
          edgesSkipped += 1
          continue
        }

        const edgeType = String(obj.type ?? obj.edgeType ?? existing?.edgeType ?? 'relates_to')
        const nextSourceRef =
          typeof obj.source_ref === 'string' ? obj.source_ref.trim() || null : sourceRef
        const nextSourceRefResolved =
          action === 'update' ? (nextSourceRef ?? existing?.sourceRef ?? null) : nextSourceRef
        const id = graphEdgeId(vaultId, fromId, toId, edgeType, nextSourceRefResolved)
        const record: GraphEdgeRawRecord = {
          id,
          schemaVersion: 1,
          vaultId,
          vaultName,
          fromId,
          toId,
          edgeType,
          props:
            obj.attrs && typeof obj.attrs === 'object'
              ? (obj.attrs as Record<string, unknown>)
              : {},
          validFrom: existing?.validFrom ?? validFrom,
          validTo: existing?.validTo ?? null,
          isCurrent: existing?.isCurrent ?? true,
          sourceKind: existing?.sourceKind ?? sourceKind,
          sourceRef: nextSourceRefResolved,
          sourceExcerpt:
            typeof obj.excerpt === 'string' ? obj.excerpt : (existing?.sourceExcerpt ?? ''),
          sourceContentHash: existing?.sourceContentHash ?? null,
          confidence: normalizeGraphExtractConfidence(
            obj.confidence,
            existing?.confidence ?? 70
          ),
          origin: preferGraphOrigin(existing?.origin, 'ai'),
          reviewStatus,
          shardMonth: existing?.shardMonth || shardMonth,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null
        }

        if (action === 'update' && existingId && existingId !== id) {
          try {
            await deleteGraphEdgeTogether(context, rawManager, existingId, existing?.shardMonth)
          } catch {
            edgesSkipped += 1
            continue
          }
        }

        await rawManager.writeRecord('graph', record, { collection: 'edges' })
        if (action === 'update') edgesUpdated += 1
        else edgesWritten += 1
      }

      const wroteLiveRecords = nodesWritten + edgesWritten + edgesUpdated > 0
      const shouldHydratePending =
        wroteLiveRecords || (edgesDeleted > 0 && !context.deleteGraphRecord)
      if (shouldHydratePending && context.syncGraphPendingIndex) {
        try {
          await context.syncGraphPendingIndex()
        } catch {
          // File write succeeded; index can catch up on next hydration
        }
      }

      const persistLine = wroteLiveRecords
        ? context.syncGraphPendingIndex
          ? `记录已落盘到 Graph/ JSONL（reviewStatus=${reviewStatus}），并已尝试灌入本地索引。`
          : `记录已落盘到 Graph/ JSONL（reviewStatus=${reviewStatus}）；派生索引将在同步后灌入。`
        : edgesDeleted
          ? context.deleteGraphRecord
            ? '文件层与本地索引已一并删除。'
            : context.syncGraphPendingIndex
              ? '文件层已删除，并已尝试同步本地索引。'
              : '文件层已删除；派生索引将在同步后更新。'
          : null

      return [
        `已写入人生关系图：节点 ${nodesWritten}，边 ${edgesWritten}` +
          (edgesUpdated ? `，改边 ${edgesUpdated}` : '') +
          (edgesDeleted ? `，删边 ${edgesDeleted}` : '') +
          (edgesSkipped ? `（跳过 ${edgesSkipped}）` : '') +
          '（已生效，可被回忆检索）。',
        `摘要: ${summary}`,
        sourceRef ? `来源: ${sourceRef}` : null,
        persistLine
      ]
        .filter(Boolean)
        .join('\n')
    } catch (e) {
      return `写入图谱失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
