/**
 * GraphUpsertTool — write entity/relation proposals into Graph JSONL via RawDataSourceManager.
 * Gate Ask is required before execute; origin=ai, reviewStatus=pending by default.
 */

import { z } from 'zod'
import type {
  GraphEdgeRawRecord,
  GraphNodeRawRecord,
  ToolRawDataSourceManager
} from '@baishou/shared'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const graphUpsertParams = z.object({
  summary: z
    .string()
    .describe(
      'Short human-readable summary of the graph write proposal shown to the user for confirmation.'
    ),
  entities: z
    .string()
    .optional()
    .describe('Optional JSON array string of entity proposals (id/name/type/attrs).'),
  edges: z
    .string()
    .optional()
    .describe('Optional JSON array string of edge proposals (from/to/type/attrs).'),
  source_ref: z
    .string()
    .optional()
    .describe('Source diary date (YYYY-MM-DD) or memory id this proposal is based on.')
})

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function parseJsonArray(raw: string | undefined): unknown[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function shardMonthFromSourceRef(sourceRef: string | undefined, now: number): string {
  if (sourceRef) {
    const m = sourceRef.match(/(\d{4})[-/](\d{2})/)
    if (m) return `${m[1]}-${m[2]}`
  }
  const d = new Date(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function inferSourceKind(sourceRef: string | undefined): GraphEdgeRawRecord['sourceKind'] {
  if (!sourceRef) return 'manual'
  if (/^\d{4}-\d{2}-\d{2}/.test(sourceRef) || sourceRef.includes('Journals/')) return 'diary'
  if (sourceRef.startsWith('mem_') || sourceRef.includes('memory')) return 'memory'
  return 'session'
}

export class GraphUpsertTool extends AgentTool<typeof graphUpsertParams> {
  readonly name = 'graph_upsert'

  readonly description =
    'Propose writing people/places/events and their relations into the user memory graph. ' +
    'Always requires explicit user confirmation. ' +
    'Use after storing relevant memory or when the user asks to record relationships. ' +
    'Do not invent sources: include source_ref when the proposal comes from a diary or memory.'

  readonly parameters = graphUpsertParams

  get category(): string {
    return 'memory'
  }

  get icon(): string {
    return 'share-2'
  }

  get displayName(): string {
    return '写入记忆图谱'
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

    const entityItems = parseJsonArray(args.entities)
    const edgeItems = parseJsonArray(args.edges)
    if (entityItems.length === 0 && edgeItems.length === 0) {
      return '未写入：entities 与 edges 均为空。请提供至少一个节点或边提案（JSON 数组）。'
    }

    const now = Date.now()
    const sourceRef = args.source_ref?.trim() || null
    const shardMonth = shardMonthFromSourceRef(sourceRef ?? undefined, now)
    const sourceKind = inferSourceKind(sourceRef ?? undefined)
    const nameToId = new Map<string, string>()

    let nodesWritten = 0
    let edgesWritten = 0

    try {
      for (const item of entityItems) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const name = String(obj.name ?? obj.label ?? '').trim()
        if (!name) continue
        const nodeType = String(obj.type ?? obj.nodeType ?? 'topic')
        const id = typeof obj.id === 'string' && obj.id ? obj.id : newId('n')
        const aliases = Array.isArray(obj.aliases)
          ? obj.aliases.filter((a): a is string => typeof a === 'string')
          : []
        const record: GraphNodeRawRecord = {
          id,
          schemaVersion: 1,
          vaultName: context.vaultName,
          nodeType,
          name,
          aliases,
          summary: typeof obj.summary === 'string' ? obj.summary : '',
          props:
            obj.attrs && typeof obj.attrs === 'object'
              ? (obj.attrs as Record<string, unknown>)
              : obj.props && typeof obj.props === 'object'
                ? (obj.props as Record<string, unknown>)
                : {},
          mentionCount: 1,
          firstSeenAt: now,
          lastSeenAt: now,
          origin: 'ai',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          reviewStatus: 'pending'
        }
        await rawManager.writeRecord('graph', record, { collection: 'nodes' })
        nameToId.set(name.toLowerCase(), id)
        if (obj.id && typeof obj.id === 'string') nameToId.set(obj.id.toLowerCase(), id)
        nodesWritten += 1
      }

      for (const item of edgeItems) {
        if (!item || typeof item !== 'object') continue
        const obj = item as Record<string, unknown>
        const fromRaw = String(obj.from ?? obj.fromId ?? '').trim()
        const toRaw = String(obj.to ?? obj.toId ?? '').trim()
        if (!fromRaw || !toRaw) continue
        const fromId = nameToId.get(fromRaw.toLowerCase()) ?? fromRaw
        const toId = nameToId.get(toRaw.toLowerCase()) ?? toRaw
        const edgeType = String(obj.type ?? obj.edgeType ?? 'relates_to')
        const id = typeof obj.id === 'string' && obj.id ? obj.id : newId('e')
        const record: GraphEdgeRawRecord = {
          id,
          schemaVersion: 1,
          vaultName: context.vaultName,
          fromId,
          toId,
          edgeType,
          props:
            obj.attrs && typeof obj.attrs === 'object'
              ? (obj.attrs as Record<string, unknown>)
              : {},
          validFrom: now,
          validTo: null,
          isCurrent: true,
          sourceKind,
          sourceRef,
          sourceExcerpt: typeof obj.excerpt === 'string' ? obj.excerpt : summary,
          sourceContentHash: null,
          confidence:
            typeof obj.confidence === 'number'
              ? Math.max(0, Math.min(100, Math.round(obj.confidence)))
              : 70,
          origin: 'ai',
          reviewStatus: 'pending',
          shardMonth,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        }
        await rawManager.writeRecord('graph', record, { collection: 'edges' })
        edgesWritten += 1
      }

      return [
        `已写入图谱提案（待确认）：节点 ${nodesWritten}，边 ${edgesWritten}。`,
        `提案摘要: ${summary}`,
        sourceRef ? `来源: ${sourceRef}` : null,
        '记录已落盘到 Graph/ JSONL（reviewStatus=pending）；派生索引将在同步后灌入。'
      ]
        .filter(Boolean)
        .join('\n')
    } catch (e) {
      return `写入图谱失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
