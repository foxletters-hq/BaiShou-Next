import type { GraphCollection } from './raw-data-source.types'
import {
  removeGraphEdge,
  removeGraphNodeAndEdges,
  type GraphShardRecordRemover,
  type GraphTombstoneLookup
} from './graph-tombstone-cascade'

export type GraphSurgicalIndexCommitter = {
  listPendingIndex(): Promise<Array<{ relativePath: string; contentHash: string }>>
  commitIndexed(collection: string, relativePath: string, contentHash: string): Promise<void>
}

export type GraphSurgicalDeleteRepo = GraphTombstoneLookup & {
  softDeleteNode(id: string): Promise<void>
  softDeleteEdge(id: string): Promise<void>
}

function normalizeShardRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

export function graphCollectionFromShardRelativePath(
  relativePath: string
): GraphCollection | null {
  const [collection] = normalizeShardRelativePath(relativePath).split('/')
  if (collection === 'nodes' || collection === 'edges' || collection === 'extract-state') {
    return collection
  }
  return null
}

/**
 * After a surgical JSONL rewrite, mark shards that became dirty only because of this
 * rewrite as already indexed. Shards that were already pending stay pending so earlier
 * unindexed rows are still hydrated later.
 */
export async function commitNewlyDirtyGraphShardsIndexed(
  manager: GraphSurgicalIndexCommitter,
  pendingBefore: ReadonlyArray<{ relativePath: string }>
): Promise<number> {
  const before = new Set(pendingBefore.map((shard) => normalizeShardRelativePath(shard.relativePath)))
  const pendingAfter = await manager.listPendingIndex()
  let committed = 0
  for (const shard of pendingAfter) {
    const relativePath = normalizeShardRelativePath(shard.relativePath)
    if (before.has(relativePath)) continue
    const collection = graphCollectionFromShardRelativePath(relativePath)
    if (collection !== 'nodes' && collection !== 'edges') continue
    await manager.commitIndexed(collection, relativePath, shard.contentHash)
    committed += 1
  }
  return committed
}

let surgicalDeleteChain: Promise<void> = Promise.resolve()

async function applyDiaryGraphSurgicalDeleteNow(input: {
  kind: 'node' | 'edge'
  id: string
  vaultId?: string
  manager: GraphShardRecordRemover & GraphSurgicalIndexCommitter
  repo: GraphSurgicalDeleteRepo
}): Promise<void> {
  const pendingBefore = await input.manager.listPendingIndex()
  if (input.kind === 'node') {
    await removeGraphNodeAndEdges(input.manager, input.repo, input.id, input.vaultId)
  } else {
    await removeGraphEdge(input.manager, input.repo, input.id, input.vaultId)
  }
  await input.repo[input.kind === 'node' ? 'softDeleteNode' : 'softDeleteEdge'](input.id)
  try {
    await commitNewlyDirtyGraphShardsIndexed(input.manager, pendingBefore)
  } catch {
    // Leave the rewritten shards dirty; the next hydration reapplies remaining live rows.
  }
}

/**
 * Delete a known node or edge: rewrite JSONL, delete SQLite rows, and mark only
 * newly dirty month shards as indexed. Does not rehydrate the rest of those months.
 * File rewrites run one at a time so two deletes cannot overwrite the same month.
 */
export async function applyDiaryGraphSurgicalDelete(input: {
  kind: 'node' | 'edge'
  id: string
  vaultId?: string
  manager: GraphShardRecordRemover & GraphSurgicalIndexCommitter
  repo: GraphSurgicalDeleteRepo
}): Promise<void> {
  const run = surgicalDeleteChain.then(() => applyDiaryGraphSurgicalDeleteNow(input))
  surgicalDeleteChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}
