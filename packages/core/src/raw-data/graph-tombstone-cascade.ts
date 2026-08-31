import type { GraphCollection } from './raw-data-source.types'

export type GraphShardRecordRemover = {
  removeRecordsFromShard(
    collection: GraphCollection,
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number>
  listShards?(): Promise<Array<{ relativePath: string; shardMonth: string }>>
}

export type GraphTombstoneLookup = {
  getNodeById(id: string, vaultId?: string): Promise<{
    id: string
    vaultId: string
    shardMonth: string
  } | null>
  getEdgeById(id: string, vaultId?: string): Promise<{
    id: string
    shardMonth: string
  } | null>
  listEdgesTouching(
    vaultId: string,
    nodeId: string
  ): Promise<Array<{ id: string; shardMonth: string }>>
}

/** Remove a node and its live edges from their month shards. Does not write deletedAt. */
export async function removeGraphNodeAndEdges(
  manager: GraphShardRecordRemover,
  repo: GraphTombstoneLookup,
  id: string,
  vaultId?: string
): Promise<void> {
  const node = await repo.getNodeById(id, vaultId)
  if (node) {
    const edges = await repo.listEdgesTouching(node.vaultId, node.id)
    const byMonth = new Map<string, string[]>()
    for (const edge of edges) {
      const month = edge.shardMonth.trim()
      if (!month) continue
      const list = byMonth.get(month) ?? []
      list.push(edge.id)
      byMonth.set(month, list)
    }
    for (const [month, ids] of byMonth) {
      await manager.removeRecordsFromShard('edges', month, ids)
    }
    if (node.shardMonth.trim()) {
      await manager.removeRecordsFromShard('nodes', node.shardMonth, [node.id])
    }
    return
  }
  await removeIdFromListedShards(manager, 'nodes', id)
}

async function removeIdFromListedShards(
  manager: GraphShardRecordRemover,
  collection: GraphCollection,
  id: string
): Promise<void> {
  const shards = (await manager.listShards?.()) ?? []
  const months = new Set<string>()
  for (const shard of shards) {
    const col = shard.relativePath.split(/[/\\]/)[0]
    if (col === collection && shard.shardMonth.trim()) months.add(shard.shardMonth.trim())
  }
  for (const month of months) {
    await manager.removeRecordsFromShard(collection, month, [id])
  }
}

export async function removeGraphEdge(
  manager: GraphShardRecordRemover,
  repo: GraphTombstoneLookup,
  id: string,
  vaultId?: string
): Promise<void> {
  const edge = await repo.getEdgeById(id, vaultId)
  const month = edge?.shardMonth.trim()
  if (!month) return
  await manager.removeRecordsFromShard('edges', month, [id])
}

/** @deprecated Use removeGraphNodeAndEdges. Kept for existing desktop/mobile call sites. */
export const tombstoneGraphNodeAndEdges = removeGraphNodeAndEdges
/** @deprecated Use removeGraphEdge. Kept for existing desktop/mobile call sites. */
export const tombstoneGraphEdge = removeGraphEdge
