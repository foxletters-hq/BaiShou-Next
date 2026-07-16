import { sqliteTable, integer, text, index, customType } from 'drizzle-orm/sqlite-core'

const sqliteVecBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'blob'
  },
  toDriver(val: Buffer): Buffer {
    return val
  },
  fromDriver(val: unknown): Buffer {
    return val as Buffer
  }
})

/** Content entities (10) + structural anchor entry */
export const GRAPH_ENTITY_TYPES = [
  'person',
  'place',
  'organization',
  'event',
  'emotion',
  'topic',
  'work',
  'activity',
  'product',
  'food'
] as const

export const GRAPH_ANCHOR_TYPES = ['entry'] as const

export const GRAPH_NODE_TYPES = [...GRAPH_ENTITY_TYPES, ...GRAPH_ANCHOR_TYPES] as const

export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number]

export const GRAPH_EDGE_TYPES = [
  'mentions',
  'participates_in',
  'located_at',
  'evokes',
  'role_of',
  'relates_to'
] as const

export type GraphEdgeType = (typeof GRAPH_EDGE_TYPES)[number]

export const graphNodesTable = sqliteTable(
  'graph_nodes',
  {
    id: text('id').primaryKey(),
    vaultName: text('vault_name').notNull(),
    nodeType: text('node_type').notNull(),
    name: text('name').notNull(),
    aliases: text('aliases').notNull().default('[]'),
    summary: text('summary').notNull().default(''),
    propsJson: text('props_json').notNull().default('{}'),
    embedding: sqliteVecBlob('embedding'),
    dimension: integer('dimension'),
    modelId: text('model_id').notNull().default(''),
    mentionCount: integer('mention_count').notNull().default(0),
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }),
    origin: text('origin').notNull().default('ai'),
    shardMonth: text('shard_month').notNull().default(''),
    reviewStatus: text('review_status').notNull().default('approved'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
  },
  (t) => [index('graph_nodes_vault_type').on(t.vaultName, t.nodeType)]
)

export const graphEdgesTable = sqliteTable(
  'graph_edges',
  {
    id: text('id').primaryKey(),
    vaultName: text('vault_name').notNull(),
    fromId: text('from_id').notNull(),
    toId: text('to_id').notNull(),
    edgeType: text('edge_type').notNull(),
    propsJson: text('props_json').notNull().default('{}'),
    validFrom: integer('valid_from', { mode: 'timestamp' }),
    validTo: integer('valid_to', { mode: 'timestamp' }),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(true),
    sourceKind: text('source_kind').notNull().default('diary'),
    sourceRef: text('source_ref'),
    sourceExcerpt: text('source_excerpt').notNull().default(''),
    sourceContentHash: text('source_content_hash'),
    confidence: integer('confidence').notNull().default(100),
    origin: text('origin').notNull().default('ai'),
    reviewStatus: text('review_status').notNull().default('approved'),
    shardMonth: text('shard_month').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().defaultNow(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().defaultNow(),
    deletedAt: integer('deleted_at', { mode: 'timestamp' })
  },
  (t) => [
    index('graph_edges_from').on(t.fromId),
    index('graph_edges_to').on(t.toId),
    index('graph_edges_vault_type_current').on(t.vaultName, t.edgeType, t.isCurrent),
    index('graph_edges_source_ref').on(t.vaultName, t.sourceRef),
    index('graph_edges_shard_month').on(t.vaultName, t.shardMonth)
  ]
)
