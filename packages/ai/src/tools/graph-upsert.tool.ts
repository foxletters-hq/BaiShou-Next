/**
 * GraphUpsertTool — write people/places/events and relations into the life graph JSONL.
 * Writes take effect immediately (reviewStatus=approved). Exact same-name updates that node;
 * the tool never merges two existing nodes. Edges can be written, updated, or deleted.
 * Gate Ask (or Allow rule) still runs before execute.
 */

import type {
  GraphEdgeRawRecord,
  GraphNodeRawRecord,
  ToolGraphNodeHit,
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
import {
  collapseGraphDisplayName,
  formatGraphUpsertCandidates,
  formatGraphUpsertCounts,
  graphUpsertSourceRefError,
  type GraphUpsertSkip
} from './graph-upsert.helpers'
import {
  asGraphUpsertObjectArray,
  graphUpsertParams,
  graphUpsertReusedFromHit,
  inferGraphSourceKind,
  resolveGraphEdgeAction,
  type GraphUpsertParams
} from './graph-upsert.schema'

async function deleteGraphNodeTogether(
  context: ToolContext,
  rawManager: ToolRawDataSourceManager,
  id: string,
  shardMonth?: string | null
): Promise<void> {
  if (context.deleteGraphRecord) {
    await context.deleteGraphRecord({ kind: 'node', id })
    return
  }
  await rawManager.tombstone('graph', id, {
    collection: 'nodes',
    shardMonth: shardMonth ?? undefined
  })
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

export class GraphUpsertTool extends AgentTool<typeof graphUpsertParams> {
  readonly name = 'graph_upsert'

  readonly description =
    'Write people, places, events and relations into the life graph (diary relations, not the notebook graph). ' +
    'Writes take effect immediately and become visible to recall_relations. ' +
    'Pass entities/edges as JSON arrays (not stringified unless you must). ' +
    'If the name and type match an existing node exactly, update that node (summary/aliases). ' +
    'Never merge two existing nodes, even when names look similar — tell the user to merge them on the graph page. ' +
    'If you pass an entity id, update that id only; do not switch it to another node. ' +
    'Names collapse newlines and repeated spaces into a single space before matching. ' +
    'To change a relation, pass the edge id from recall_relations with action=update (type/excerpt/from/to) or action=delete. ' +
    'update and delete require that edge id; without it the row is skipped with missing_id. ' +
    'If an endpoint name matches several nodes (for example a person and a product both named Latte), pass from_type/to_type or an explicit node id; otherwise the edge is skipped as ambiguous_node. ' +
    'Call this when the user asks you to remember or correct a relationship. Requires Gate confirmation. ' +
    'Do not invent sources: include source_ref when the write comes from a diary or memory. ' +
    'source_ref must be a real YYYY-MM-DD or a memory id. ' +
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

  async execute(args: GraphUpsertParams, context: ToolContext): Promise<string> {
    const summary = args.summary.trim()
    if (!summary) {
      return '请提供 summary，说明拟写入图谱的内容。'
    }

    const rawManager = context.rawDataSourceManager as ToolRawDataSourceManager | undefined
    if (!rawManager) {
      return '原始数据源管理器未就绪，无法落盘图谱提案。请重启应用或检查 Vault。'
    }

    const entityItems = asGraphUpsertObjectArray(args.entities)
    const edgeItems = asGraphUpsertObjectArray(args.edges)
    if (entityItems.length === 0 && edgeItems.length === 0) {
      return '未写入：entities 与 edges 均为空。请提供至少一个节点或边提案（JSON 数组）。'
    }

    const sourceRefsToCheck = [
      args.source_ref,
      ...edgeItems.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const ref = (item as Record<string, unknown>).source_ref
        return typeof ref === 'string' ? [ref] : []
      })
    ]
    for (const rawRef of sourceRefsToCheck) {
      if (typeof rawRef !== 'string') continue
      const sourceError = graphUpsertSourceRefError(rawRef)
      if (sourceError) return sourceError
    }

    const now = Date.now()
    const sourceRef = args.source_ref?.trim() || null
    const diary = graphDiaryInstant(sourceRef ?? undefined, now)
    const shardMonth = diary.shardMonth
    const validFrom = diary.validFrom ?? now
    const sourceKind = inferGraphSourceKind(sourceRef ?? undefined)
    const nameToId = new Map<string, string>()
    const vaultId = context.vaultId
    const vaultName = context.vaultName
    const reviewStatus = 'approved' as const

    let nodesCreated = 0
    let nodesUpdated = 0
    let nodesDeleted = 0
    let edgesWritten = 0
    let edgesUpdated = 0
    let edgesDeleted = 0
    const skips: GraphUpsertSkip[] = []

    try {
      for (const item of entityItems) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const name = collapseGraphDisplayName(String(obj.name ?? obj.label ?? ''))
        const explicitId = typeof obj.id === 'string' ? obj.id.trim() : ''
        const action = obj.action === 'delete' ? 'delete' : 'write'
        if (!name && !explicitId) continue
        const nodeType = String(obj.type ?? obj.nodeType ?? 'topic')
          .trim()
          .toLowerCase()
        if (nodeType === 'entry') continue

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
          discriminator?: string
        } | null = null
        if (explicitId) {
          const byId = context.graphNodeLookup?.findNodeById
            ? await context.graphNodeLookup.findNodeById(explicitId)
            : null
          id = byId?.id ?? explicitId
          reused = graphUpsertReusedFromHit(byId)
        } else if (context.graphNodeLookup && name) {
          const hit = await context.graphNodeLookup.findNodeByName({ name, nodeType })
          if (hit) {
            id = hit.id
            reused = graphUpsertReusedFromHit(hit)
          }
        }
        if (!id && name) {
          id = graphNodeIdForEntity(vaultId, nodeType, name)
        }

        if (action === 'delete') {
          if (!id) {
            skips.push({ reason: 'missing_id', id: explicitId || name })
            continue
          }
          try {
            await deleteGraphNodeTogether(context, rawManager, id, reused?.shardMonth || shardMonth)
            nodesDeleted += 1
          } catch {
            skips.push({ reason: 'not_found', id })
          }
          continue
        }

        if (!id) continue

        const incomingAliases = Array.isArray(obj.aliases)
          ? obj.aliases
              .filter((a): a is string => typeof a === 'string')
              .map((a) => collapseGraphDisplayName(a))
              .filter(Boolean)
          : []
        const aliases = [...new Set([...(reused?.aliases ?? []), name, ...incomingAliases])]
        const record: GraphNodeRawRecord = {
          id,
          schemaVersion: 1,
          vaultId,
          vaultName,
          nodeType: reused?.nodeType || nodeType,
          name: reused?.name ?? name,
          discriminator: reused?.discriminator,
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
          origin: preferGraphOrigin(reused?.origin, 'user'),
          shardMonth: reused?.shardMonth || shardMonth,
          createdAt: reused?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          reviewStatus
        }
        await rawManager.writeRecord('graph', record, { collection: 'nodes' })
        nameToId.set(normalizeGraphName(name), id)
        if (obj.id && typeof obj.id === 'string') nameToId.set(normalizeGraphName(obj.id), id)
        if (reused) nodesUpdated += 1
        else nodesCreated += 1
      }

      type ResolvedEnd =
        | { kind: 'id'; id: string }
        | { kind: 'ambiguous'; candidates: ToolGraphNodeHit[] }

      const resolveEnd = async (raw: string, nodeType?: string): Promise<ResolvedEnd | null> => {
        const key = normalizeGraphName(raw)
        if (!key) return null
        // 本批次刚写入的同名实体优先（nameToId 由 entities 构建）
        if (nameToId.has(key)) return { kind: 'id', id: nameToId.get(key)! }
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(raw)) return { kind: 'id', id: raw }
        if (context.graphNodeLookup) {
          const byId = context.graphNodeLookup.findNodeById
            ? await context.graphNodeLookup.findNodeById(raw)
            : null
          if (byId) {
            nameToId.set(key, byId.id)
            return { kind: 'id', id: byId.id }
          }
          if (context.graphNodeLookup.findNodesByName) {
            const hits = await context.graphNodeLookup.findNodesByName({ name: raw, nodeType })
            const unique = [
              ...new Map(
                hits
                  .filter((hit) => !nodeType || hit.nodeType === nodeType)
                  .map((hit) => [hit.id, hit])
              ).values()
            ]
            if (unique.length === 0) return null
            // 同名跨类型（如 person/product 都叫 Latte）或多条同类型同名节点：
            // 不猜第一条，交给模型补 from_type/to_type 或节点 id。
            if (unique.length > 1) return { kind: 'ambiguous', candidates: unique }
            nameToId.set(key, unique[0]!.id)
            return { kind: 'id', id: unique[0]!.id }
          }
          const hit = await context.graphNodeLookup.findNodeByName({ name: raw, nodeType })
          if (hit) {
            nameToId.set(key, hit.id)
            return { kind: 'id', id: hit.id }
          }
        }
        return null
      }

      for (const item of edgeItems) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const action = resolveGraphEdgeAction(obj)
        const existingId = typeof obj.id === 'string' ? obj.id.trim() : ''

        if (action === 'delete') {
          if (!existingId) {
            skips.push({ reason: 'missing_id' })
            continue
          }
          const existing = context.graphEdgeLookup
            ? await context.graphEdgeLookup.findEdgeById(existingId)
            : null
          if (!existing) {
            skips.push({ reason: 'not_found', id: existingId })
            continue
          }
          try {
            await deleteGraphEdgeTogether(context, rawManager, existingId, existing.shardMonth)
            edgesDeleted += 1
          } catch {
            skips.push({ reason: 'not_found', id: existingId })
          }
          continue
        }

        if (action === 'update' && !existingId) {
          skips.push({
            reason: 'missing_id',
            from: collapseGraphDisplayName(String(obj.from ?? obj.fromId ?? '')),
            to: collapseGraphDisplayName(String(obj.to ?? obj.toId ?? ''))
          })
          continue
        }

        const existing =
          action === 'update' && existingId && context.graphEdgeLookup
            ? await context.graphEdgeLookup.findEdgeById(existingId)
            : null
        if (action === 'update' && existingId && !existing) {
          skips.push({ reason: 'not_found', id: existingId })
          continue
        }

        const fromRaw = collapseGraphDisplayName(
          String(obj.from ?? obj.fromId ?? existing?.fromId ?? '')
        )
        const toRaw = collapseGraphDisplayName(String(obj.to ?? obj.toId ?? existing?.toId ?? ''))
        const fromType =
          typeof obj.from_type === 'string'
            ? collapseGraphDisplayName(obj.from_type).toLowerCase() || undefined
            : undefined
        const toType =
          typeof obj.to_type === 'string'
            ? collapseGraphDisplayName(obj.to_type).toLowerCase() || undefined
            : undefined
        const fromResolved = await resolveEnd(fromRaw, fromType)
        if (fromResolved?.kind === 'ambiguous') {
          skips.push({
            reason: 'ambiguous_node',
            from: fromRaw,
            to: toRaw,
            candidates: formatGraphUpsertCandidates(fromResolved.candidates)
          })
          continue
        }
        const toResolved = await resolveEnd(toRaw, toType)
        if (toResolved?.kind === 'ambiguous') {
          skips.push({
            reason: 'ambiguous_node',
            from: fromRaw,
            to: toRaw,
            candidates: formatGraphUpsertCandidates(toResolved.candidates)
          })
          continue
        }
        const fromId = fromResolved?.id
        const toId = toResolved?.id
        if (!fromId || !toId) {
          skips.push({ reason: 'missing_node', from: fromRaw, to: toRaw })
          continue
        }

        const edgeType = String(obj.type ?? obj.edgeType ?? existing?.edgeType ?? 'relates_to')
        const nextSourceRef =
          typeof obj.source_ref === 'string' ? obj.source_ref.trim() || null : sourceRef
        const nextSourceRefResolved =
          action === 'update' ? (nextSourceRef ?? existing?.sourceRef ?? null) : nextSourceRef
        const id = graphEdgeId(vaultId, fromId, toId, edgeType, nextSourceRefResolved)

        const edgeDiary =
          nextSourceRefResolved && nextSourceRefResolved !== sourceRef
            ? graphDiaryInstant(nextSourceRefResolved, now)
            : diary
        const edgeValidFrom = edgeDiary.validFrom ?? (nextSourceRefResolved ? now : validFrom)
        const edgeShardMonth = edgeDiary.shardMonth || shardMonth
        const edgeSourceKind = nextSourceRefResolved
          ? inferGraphSourceKind(nextSourceRefResolved)
          : sourceKind

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
          validFrom: existing?.validFrom ?? edgeValidFrom,
          // 显式写入/更新即恢复为当前边：避免改一条已失效的边后仍然是失效态。
          validTo: null,
          isCurrent: true,
          sourceKind: existing?.sourceKind ?? edgeSourceKind,
          sourceRef: nextSourceRefResolved,
          sourceExcerpt:
            typeof obj.excerpt === 'string' ? obj.excerpt : (existing?.sourceExcerpt ?? ''),
          sourceContentHash: existing?.sourceContentHash ?? null,
          confidence: normalizeGraphExtractConfidence(obj.confidence, existing?.confidence ?? 70),
          // Gate 已由用户确认，工具写入按 user 来源处理，日记重新抽取时不会被当作旧 AI 边清掉。
          origin: preferGraphOrigin(existing?.origin, 'user'),
          reviewStatus,
          shardMonth: existing?.shardMonth || edgeShardMonth,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null
        }

        if (action === 'update' && existingId && existingId !== id) {
          try {
            await deleteGraphEdgeTogether(context, rawManager, existingId, existing?.shardMonth)
          } catch {
            skips.push({ reason: 'not_found', id: existingId })
            continue
          }
        }

        await rawManager.writeRecord('graph', record, { collection: 'edges' })
        if (action === 'update') edgesUpdated += 1
        else edgesWritten += 1
      }

      const wroteLiveRecords = nodesCreated + nodesUpdated + edgesWritten + edgesUpdated > 0
      const anyDeleted = edgesDeleted > 0 || nodesDeleted > 0
      const shouldHydratePending = wroteLiveRecords || (anyDeleted && !context.deleteGraphRecord)
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
        : anyDeleted
          ? context.deleteGraphRecord
            ? '文件层与本地索引已一并删除。'
            : context.syncGraphPendingIndex
              ? '文件层已删除，并已尝试同步本地索引。'
              : '文件层已删除；派生索引将在同步后更新。'
          : null

      return [
        formatGraphUpsertCounts({
          nodesCreated,
          nodesUpdated,
          nodesDeleted,
          edgesWritten,
          edgesUpdated,
          edgesDeleted,
          skips
        }),
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
