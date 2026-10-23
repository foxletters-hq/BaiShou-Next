import { z } from 'zod'
import type { GraphEdgeRawRecord, ToolGraphNodeHit } from '@baishou/shared'

/**
 * graph_upsert 的参数定义与纯解析工具。
 * 这里只放不依赖 ToolContext / 落盘逻辑的内容，执行语义仍留在 graph-upsert.tool.ts。
 */

const entityItem = z
  .object({
    name: z
      .string()
      .optional()
      .describe(
        'Display name of the person, place, event, or topic. Required when creating; optional when deleting by id.'
      ),
    type: z
      .string()
      .optional()
      .describe(
        'Entity type: person, place, organization, event, topic, emotion, work, activity, product, food. Default topic.'
      ),
    aliases: z.array(z.string()).optional(),
    summary: z.string().optional(),
    id: z.string().optional(),
    action: z
      .enum(['write', 'update', 'delete'])
      .optional()
      .describe('write = new or update node (default). delete = remove a node (needs id or name).')
  })
  .passthrough()

const edgeItem = z
  .object({
    from: z.string().optional().describe('Source entity name or id.'),
    from_type: z
      .string()
      .optional()
      .describe(
        'Optional type of the source entity (person/place/...). Required when several nodes share the same name, e.g. person Latte vs product Latte.'
      ),
    to: z.string().optional().describe('Target entity name or id.'),
    to_type: z
      .string()
      .optional()
      .describe(
        'Optional type of the target entity (person/place/...). Required when several nodes share the same name.'
      ),
    type: z
      .string()
      .optional()
      .describe('Relation type, e.g. knows / located_at / participates_in.'),
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

const jsonArrayOrList = <T extends z.ZodTypeAny>(item: T, description: string) =>
  z
    .union([z.array(item), z.string()])
    .optional()
    .describe(description)

export const graphUpsertParams = z.object({
  summary: z
    .string()
    .describe(
      'Short human-readable summary of the graph write proposal shown to the user for confirmation.'
    ),
  entities: jsonArrayOrList(
    entityItem,
    'Entities to upsert or delete. Prefer a JSON array of {name, type?, action?, id?, aliases?, summary?}. A JSON array string is also accepted.'
  ),
  edges: jsonArrayOrList(
    edgeItem,
    'Relations to upsert or delete. Prefer a JSON array of {from, to, type, excerpt?, action?, id?}. Names are resolved to existing nodes. A JSON array string is also accepted.'
  ),
  source_ref: z
    .string()
    .optional()
    .describe('Source diary date (YYYY-MM-DD) or memory id this proposal is based on.')
})

export type GraphUpsertParams = z.infer<typeof graphUpsertParams>

function parseJsonArray(raw: string | undefined): unknown[] {
  if (!raw?.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** 接受原生数组、JSON 数组字符串，其它输入一律视为空。 */
export function asGraphUpsertObjectArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') return parseJsonArray(raw)
  return []
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 根据 source_ref 推断来源类型，保持与历史落盘一致。 */
export function inferGraphSourceKind(
  sourceRef: string | undefined
): GraphEdgeRawRecord['sourceKind'] {
  if (!sourceRef) return 'manual'
  if (/^\d{4}-\d{2}-\d{2}/.test(sourceRef) || sourceRef.includes('Journals/')) return 'diary'
  if (sourceRef.startsWith('mem_') || sourceRef.includes('memory') || UUID_RE.test(sourceRef))
    return 'memory'
  return 'session'
}

/** 节点命中结果中可复用的字段（避免把查询对象上的额外字段带进落盘记录）。 */
export type GraphUpsertReusedNode = {
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
}

export function graphUpsertReusedFromHit(
  hit: (ToolGraphNodeHit & GraphUpsertReusedNode) | null | undefined
): GraphUpsertReusedNode | null {
  if (!hit) return null
  return {
    name: hit.name,
    nodeType: hit.nodeType,
    aliases: hit.aliases,
    summary: hit.summary,
    mentionCount: hit.mentionCount,
    firstSeenAt: hit.firstSeenAt,
    createdAt: hit.createdAt,
    shardMonth: hit.shardMonth,
    origin: hit.origin,
    discriminator: hit.discriminator
  }
}

/** 统一边动作的别名（remove/patch/upsert 等），缺省按 write 处理。 */
export function resolveGraphEdgeAction(
  obj: Record<string, unknown>
): 'write' | 'update' | 'delete' {
  const raw = String(obj.action ?? '')
    .trim()
    .toLowerCase()
  if (raw === 'delete' || raw === 'remove') return 'delete'
  if (raw === 'update' || raw === 'patch') return 'update'
  if (raw === 'write' || raw === 'upsert' || raw === 'create') return 'write'
  if (typeof obj.id === 'string' && obj.id.trim()) return 'update'
  return 'write'
}
