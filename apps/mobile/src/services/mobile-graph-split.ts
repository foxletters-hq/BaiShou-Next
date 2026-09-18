import {
  revertGraphNodeSplit,
  splitGraphNode,
  type GraphSplitEdgeAssignment,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { GraphRepository, type AppDatabase } from '@baishou/database'
import { readGraphNameRegistry } from '@baishou/shared'
import i18n from 'i18next'
import {
  ensureMobileRawDataRuntime,
  syncMobileGraphPendingIndex
} from './mobile-raw-data-source.runtime'

export type MobileGraphNameCandidate = {
  nodeId: string
  name: string
  discriminator: string
  label: string
}

export type MobileSplitEdgeRow = {
  edgeId: string
  edgeType: string
  partnerName: string
  sourceRef: string | null
  sourceExcerpt: string
}

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

export function toMobileNameCandidate(
  row: { id: string; name: string; discriminator?: string },
  label?: string
): MobileGraphNameCandidate {
  const discriminator = row.discriminator ?? ''
  return {
    nodeId: row.id,
    name: row.name,
    discriminator,
    label: label?.trim() || (discriminator ? discriminator : row.name)
  }
}

export async function mobileListNameCandidates(
  drizzleDb: AppDatabase,
  nodeId: string
): Promise<MobileGraphNameCandidate[]> {
  const repo = new GraphRepository(drizzleDb)
  const node = await repo.getNodeById(nodeId)
  if (!node) return []
  const rows = await repo.findNodesByNameOrAlias(node.vaultId, node.name, node.nodeType)
  const bare = rows.find((row) => !(row.discriminator ?? '')) ?? rows[0] ?? node
  const registry = readGraphNameRegistry(parseProps(bare.propsJson))
  const labelById = new Map(registry.map((entry) => [entry.nodeId, entry.label]))
  const seen = new Set<string>()
  const candidates: MobileGraphNameCandidate[] = []
  for (const row of rows) {
    seen.add(row.id)
    candidates.push(toMobileNameCandidate(row, labelById.get(row.id)))
  }
  for (const entry of registry) {
    if (seen.has(entry.nodeId)) continue
    seen.add(entry.nodeId)
    candidates.push({
      nodeId: entry.nodeId,
      name: node.name,
      discriminator: entry.discriminator,
      label: entry.label
    })
  }
  return candidates
}

export async function mobileListSplitEdges(
  drizzleDb: AppDatabase,
  nodeId: string
): Promise<MobileSplitEdgeRow[]> {
  const repo = new GraphRepository(drizzleDb)
  const node = await repo.getNodeById(nodeId)
  if (!node) return []
  const edges = await repo.listEdgesTouching(node.vaultId, nodeId)
  const partnerIds = [
    ...new Set(edges.map((edge) => (edge.fromId === nodeId ? edge.toId : edge.fromId)))
  ]
  const partners = await repo.getNodesByIds(node.vaultId, partnerIds)
  const nameById = new Map(partners.map((partner) => [partner.id, partner.name]))
  return edges.map((edge) => {
    const partnerId = edge.fromId === nodeId ? edge.toId : edge.fromId
    return {
      edgeId: edge.id,
      edgeType: edge.edgeType,
      partnerName: nameById.get(partnerId) || partnerId,
      sourceRef: edge.sourceRef,
      sourceExcerpt: edge.sourceExcerpt ?? ''
    }
  })
}

export async function mobileSplitGraphNode(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  bareNodeId: string
  discriminator: string
  label: string
  summary?: string
  edgeAssignments?: GraphSplitEdgeAssignment[]
  reason?: string
}): Promise<{
  bareNodeId: string
  splitNodeId: string
  movedEdgeIds: string[]
  unassignedEdgeIds: string[]
}> {
  const repo = new GraphRepository(options.drizzleDb)
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const result = await splitGraphNode({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    bareNodeId: options.bareNodeId,
    discriminator: options.discriminator,
    label: options.label,
    summary: options.summary,
    edgeAssignments: options.edgeAssignments ?? [],
    reason: options.reason,
    manager: graphManager,
    repo
  })
  await syncMobileGraphPendingIndex({ drizzleDb: options.drizzleDb })
  return result
}

export async function mobileRevertGraphNodeSplit(options: {
  drizzleDb: AppDatabase
  pathService: IStoragePathService
  fileSystem: IFileSystem
  vaultId: string
  vaultName: string
  bareNodeId: string
  discriminator: string
  reason?: string
}): Promise<{ removedNodeId: string | null }> {
  const repo = new GraphRepository(options.drizzleDb)
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const result = await revertGraphNodeSplit({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    bareNodeId: options.bareNodeId,
    discriminator: options.discriminator,
    reason: options.reason,
    manager: graphManager,
    repo
  })
  if (!result.removedNodeId) {
    await syncMobileGraphPendingIndex({ drizzleDb: options.drizzleDb })
    return result
  }
  const { syncDiaryGraphMergeIntoIndex } = await import('@baishou/core-mobile')
  await syncDiaryGraphMergeIntoIndex({
    loserId: result.removedNodeId,
    syncPendingIndex: async () => {
      await syncMobileGraphPendingIndex({ drizzleDb: options.drizzleDb })
    },
    softDeleteNode: (id) => repo.softDeleteNode(id)
  })
  return result
}

export function mobileSplitErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : i18n.t('graph.split_failed', '拆分失败')
}
