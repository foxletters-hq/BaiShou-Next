import { notebookGraphEdgesTable, notebookGraphNodesTable } from '../schema/knowledge'

/** 画布视图不读 embedding blob，避免打开图时把整库向量拷进 IPC。 */
export const NOTEBOOK_GRAPH_VIEW_NODE_COLUMNS = {
  id: notebookGraphNodesTable.id,
  vaultId: notebookGraphNodesTable.vaultId,
  notebookId: notebookGraphNodesTable.notebookId,
  nodeType: notebookGraphNodesTable.nodeType,
  name: notebookGraphNodesTable.name,
  nameNormalized: notebookGraphNodesTable.nameNormalized,
  discriminator: notebookGraphNodesTable.discriminator,
  aliases: notebookGraphNodesTable.aliases,
  summary: notebookGraphNodesTable.summary,
  propsJson: notebookGraphNodesTable.propsJson,
  mentionCount: notebookGraphNodesTable.mentionCount,
  firstSeenAt: notebookGraphNodesTable.firstSeenAt,
  lastSeenAt: notebookGraphNodesTable.lastSeenAt,
  origin: notebookGraphNodesTable.origin,
  shardMonth: notebookGraphNodesTable.shardMonth,
  reviewStatus: notebookGraphNodesTable.reviewStatus,
  createdAt: notebookGraphNodesTable.createdAt,
  updatedAt: notebookGraphNodesTable.updatedAt,
  deletedAt: notebookGraphNodesTable.deletedAt
} as const

export const NOTEBOOK_GRAPH_VIEW_EDGE_COLUMNS = {
  id: notebookGraphEdgesTable.id,
  vaultId: notebookGraphEdgesTable.vaultId,
  notebookId: notebookGraphEdgesTable.notebookId,
  fromId: notebookGraphEdgesTable.fromId,
  toId: notebookGraphEdgesTable.toId,
  edgeType: notebookGraphEdgesTable.edgeType,
  validFrom: notebookGraphEdgesTable.validFrom,
  validTo: notebookGraphEdgesTable.validTo,
  isCurrent: notebookGraphEdgesTable.isCurrent,
  sourceKind: notebookGraphEdgesTable.sourceKind,
  sourceRef: notebookGraphEdgesTable.sourceRef,
  sourceExcerpt: notebookGraphEdgesTable.sourceExcerpt,
  confidence: notebookGraphEdgesTable.confidence,
  origin: notebookGraphEdgesTable.origin,
  reviewStatus: notebookGraphEdgesTable.reviewStatus,
  shardMonth: notebookGraphEdgesTable.shardMonth,
  createdAt: notebookGraphEdgesTable.createdAt,
  updatedAt: notebookGraphEdgesTable.updatedAt,
  deletedAt: notebookGraphEdgesTable.deletedAt
} as const
