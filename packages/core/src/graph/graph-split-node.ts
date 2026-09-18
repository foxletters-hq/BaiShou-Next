/**
 * 用户确认的同名拆分：裸名节点保持原 ID，第二个实体带区分信息。
 * 先写登记与新节点再改挂边，中断后才能从登记看出拆到哪一步。
 */

import type { GraphEdgeRawRecord, GraphNodeRawRecord } from '@baishou/shared'
import {
  graphNodeIdForEntity,
  logger,
  normalizeGraphDiscriminator,
  readGraphNameRegistry,
  removeGraphNameRegistryEntry,
  upsertGraphNameRegistryEntry
} from '@baishou/shared'
import { mergeDiaryGraphNodes } from './graph-merge-nodes'

type SplitNode = {
  id: string
  vaultId: string
  nodeType: string
  name: string
  aliases: string[]
  summary: string
  propsJson?: string
  mentionCount: number
  firstSeenAt: number | null
  lastSeenAt: number | null
  origin: string
  shardMonth: string
  reviewStatus?: string
  createdAt: number
  discriminator?: string
}

type SplitEdge = {
  id: string
  vaultId: string
  fromId: string
  toId: string
  edgeType: string
  propsJson?: string
  validFrom: number | null
  validTo: number | null
  isCurrent: boolean
  sourceKind: string
  sourceRef: string | null
  sourceExcerpt: string
  sourceContentHash: string | null
  confidence: number
  origin: string
  reviewStatus: string
  shardMonth: string
  createdAt: number
}

export type GraphSplitRawWriter = {
  writeRecord(
    record: GraphNodeRawRecord | GraphEdgeRawRecord,
    opts: { collection: 'nodes' | 'edges' }
  ): Promise<unknown>
  removeRecordsFromShard(
    collection: 'nodes' | 'edges',
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
}

export type GraphSplitLookup = {
  getNodeById(id: string, vaultId?: string): Promise<SplitNode | null>
  listEdgesTouching(vaultId: string, nodeId: string): Promise<SplitEdge[]>
}

export type GraphSplitEdgeAssignment = { edgeId: string; target: 'bare' | 'split' }

function parseProps(raw?: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function asOrigin(value: string | undefined): 'ai' | 'user' {
  return value === 'user' ? 'user' : 'ai'
}

function asReview(value: string | undefined): 'approved' | 'pending' | 'rejected' {
  if (value === 'pending' || value === 'rejected') return value
  return 'approved'
}

function seenOrNow(value: number | null | undefined, now: number): number {
  return value == null || !Number.isFinite(value) ? now : value
}

function toBareNodeRecord(input: {
  vaultId: string
  vaultName: string
  node: SplitNode
  props: Record<string, unknown>
  now: number
}): GraphNodeRawRecord {
  return {
    id: input.node.id,
    schemaVersion: 1,
    vaultId: input.vaultId,
    vaultName: input.vaultName,
    nodeType: input.node.nodeType,
    name: input.node.name,
    discriminator: input.node.discriminator ?? '',
    aliases: [...(input.node.aliases ?? [])],
    summary: input.node.summary || '',
    props: input.props,
    mentionCount: input.node.mentionCount ?? 0,
    firstSeenAt: seenOrNow(input.node.firstSeenAt, input.now),
    lastSeenAt: seenOrNow(input.node.lastSeenAt, input.now),
    origin: asOrigin(input.node.origin),
    shardMonth: input.node.shardMonth,
    createdAt: input.node.createdAt,
    updatedAt: input.now,
    deletedAt: null,
    reviewStatus: asReview(input.node.reviewStatus)
  }
}

export async function splitGraphNode(input: {
  vaultId: string
  vaultName: string
  bareNodeId: string
  discriminator: string
  label: string
  summary?: string
  edgeAssignments: readonly GraphSplitEdgeAssignment[]
  reason?: string
  now?: number
  manager: GraphSplitRawWriter
  repo: GraphSplitLookup
}): Promise<{
  bareNodeId: string
  splitNodeId: string
  movedEdgeIds: string[]
  unassignedEdgeIds: string[]
}> {
  const discriminator = normalizeGraphDiscriminator(input.discriminator)
  if (!discriminator) {
    throw new Error('区分信息不能为空')
  }

  const bareNodeId = input.bareNodeId.trim()
  const bare = await input.repo.getNodeById(bareNodeId, input.vaultId)
  if (!bare) {
    throw new Error('裸名节点不存在')
  }
  if (bare.vaultId !== input.vaultId) {
    throw new Error('裸名节点不属于当前库')
  }
  if (bare.nodeType === 'entry') {
    throw new Error('日记锚点不能拆分')
  }
  if (!bare.shardMonth) {
    throw new Error('裸名节点缺少分片月份')
  }

  const now = input.now ?? Date.now()
  const bareProps = parseProps(bare.propsJson)
  const existingEntry = readGraphNameRegistry(bareProps).find(
    (entry) => normalizeGraphDiscriminator(entry.discriminator) === discriminator
  )
  // 已登记则复用原 nodeId，避免同一区分信息算出第二套身份
  const splitNodeId =
    existingEntry?.nodeId ??
    graphNodeIdForEntity(input.vaultId, bare.nodeType, bare.name, discriminator)
  const existingSplit = await input.repo.getNodeById(splitNodeId, input.vaultId)
  const splitExists = Boolean(existingSplit && existingSplit.vaultId === input.vaultId)

  const registeredProps = upsertGraphNameRegistryEntry(bareProps, {
    discriminator,
    label: input.label,
    nodeId: splitNodeId,
    // 登记时间是「什么时候定下这个身份」，重试不得刷新
    registeredAt: existingEntry?.registeredAt ?? now
  })
  await input.manager.writeRecord(
    toBareNodeRecord({
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      node: bare,
      props: registeredProps,
      now
    }),
    { collection: 'nodes' }
  )

  // 只看登记会漏掉「登记已写、节点没建成」的中间态，必须查到节点才跳过补建
  if (!splitExists) {
    const splitRecord: GraphNodeRawRecord = {
      id: splitNodeId,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      nodeType: bare.nodeType,
      name: bare.name,
      discriminator,
      aliases: [bare.name],
      summary: input.summary ?? '',
      props: { splitReason: input.reason?.trim() || 'explicit-split' },
      mentionCount: 0,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'user',
      shardMonth: bare.shardMonth,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      reviewStatus: 'approved'
    }
    await input.manager.writeRecord(splitRecord, { collection: 'nodes' })
  }

  const touching = await input.repo.listEdgesTouching(input.vaultId, bareNodeId)
  const assignedIds = new Set(input.edgeAssignments.map((item) => item.edgeId))
  const unassignedEdgeIds = touching
    .filter((edge) => !assignedIds.has(edge.id))
    .map((edge) => edge.id)
  const touchingById = new Map(touching.map((edge) => [edge.id, edge]))
  const movedEdgeIds: string[] = []

  for (const assignment of input.edgeAssignments) {
    if (assignment.target !== 'split') continue
    const edge = touchingById.get(assignment.edgeId)
    if (!edge) continue
    // 已经不再碰裸名节点，说明上一次已经改挂过，重入时不能再写一遍
    if (edge.fromId !== bareNodeId && edge.toId !== bareNodeId) continue

    const fromId = edge.fromId === bareNodeId ? splitNodeId : edge.fromId
    const toId = edge.toId === bareNodeId ? splitNodeId : edge.toId
    const shardMonth = edge.shardMonth || bare.shardMonth
    if (!shardMonth) {
      logger.warn('[graph] split skip edge without shardMonth', { edgeId: edge.id })
      continue
    }
    if (fromId === toId) {
      await input.manager.removeRecordsFromShard('edges', shardMonth, [edge.id])
      movedEdgeIds.push(edge.id)
      continue
    }
    // 边 ID 按公式会随端点变化，但合并已经选择保留原 ID。
    // 这里跟合并一致：换 ID 会在同步后留下两条重复边。
    const remapped: GraphEdgeRawRecord = {
      id: edge.id,
      schemaVersion: 1,
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      fromId,
      toId,
      edgeType: edge.edgeType,
      props: parseProps(edge.propsJson),
      validFrom: edge.validFrom,
      validTo: edge.validTo,
      isCurrent: edge.isCurrent,
      sourceKind: edge.sourceKind,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt,
      sourceContentHash: edge.sourceContentHash,
      confidence: edge.confidence,
      origin: asOrigin(edge.origin),
      reviewStatus: asReview(edge.reviewStatus),
      shardMonth,
      createdAt: edge.createdAt,
      updatedAt: now,
      deletedAt: null
    }
    await input.manager.writeRecord(remapped, { collection: 'edges' })
    movedEdgeIds.push(edge.id)
  }

  return {
    bareNodeId,
    splitNodeId,
    movedEdgeIds,
    unassignedEdgeIds
  }
}

export async function revertGraphNodeSplit(input: {
  vaultId: string
  vaultName: string
  bareNodeId: string
  discriminator: string
  reason?: string
  now?: number
  manager: GraphSplitRawWriter
  repo: GraphSplitLookup
}): Promise<{ removedNodeId: string | null }> {
  const discriminator = normalizeGraphDiscriminator(input.discriminator)
  const bareNodeId = input.bareNodeId.trim()
  const bare = await input.repo.getNodeById(bareNodeId, input.vaultId)
  if (!bare || bare.vaultId !== input.vaultId) {
    return { removedNodeId: null }
  }

  const existingEntry = readGraphNameRegistry(parseProps(bare.propsJson)).find(
    (entry) => normalizeGraphDiscriminator(entry.discriminator) === discriminator
  )
  if (!existingEntry) {
    return { removedNodeId: null }
  }

  const now = input.now ?? Date.now()
  const splitNode = await input.repo.getNodeById(existingEntry.nodeId, input.vaultId)
  const splitExists = Boolean(splitNode && splitNode.vaultId === input.vaultId)
  if (splitExists) {
    await mergeDiaryGraphNodes({
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      survivorId: bareNodeId,
      loserId: existingEntry.nodeId,
      reason: input.reason?.trim() || 'revert-split',
      now,
      manager: input.manager,
      repo: input.repo
    })
  }

  // 合并会重写 survivor 的 props，必须重新读；跳过合并时用进函数时读到的裸名节点
  const afterMerge = splitExists ? await input.repo.getNodeById(bareNodeId, input.vaultId) : bare
  if (!afterMerge || !afterMerge.shardMonth) {
    throw new Error('撤回拆分后裸名节点不可用')
  }
  const clearedProps = removeGraphNameRegistryEntry(parseProps(afterMerge.propsJson), discriminator)
  await input.manager.writeRecord(
    toBareNodeRecord({
      vaultId: input.vaultId,
      vaultName: input.vaultName,
      node: afterMerge,
      props: clearedProps,
      now
    }),
    { collection: 'nodes' }
  )

  // 节点已经没了只清登记，返回 null 让用户再点一次也不报错
  return { removedNodeId: splitExists ? existingEntry.nodeId : null }
}
