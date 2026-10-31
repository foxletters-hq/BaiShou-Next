import type { GraphSyncApply } from '@baishou/database/shared'
import {
  graphNodeCardText,
  isVaultId,
  normalizeGraphDiscriminator,
  preferGraphOrigin,
  shouldReuseGraphNodeEmbed
} from '@baishou/shared'
import type { GraphEdgeRawRecord, GraphNodeRawRecord } from './raw-data-source.types'
import { collapseJsonlById } from './stores/monthly-jsonl.store'
import type { GraphIndexSource } from './graph-index-source'
import {
  collectAbsentDeleteIds,
  collectPresentMonths,
  type GraphAbsentSweepMode
} from './graph-orphan-sweep.util'

export interface GraphSyncEmbedder {
  embedQuery?(text: string): Promise<number[] | null>
  modelId?: string
}

export type GraphPrecomputedNodeEmbedding = {
  embedding: number[]
  text: string
}

export interface GraphPendingIndexSyncOpts {
  absentSweep?: GraphAbsentSweepMode
  deletedShardPaths?: string[]
  vaultId?: string
  /** 对齐阶段已算出的节点向量。名片文本对得上才用，对不上当没传。 */
  precomputedNodeEmbeddings?: ReadonlyMap<string, GraphPrecomputedNodeEmbedding>
}

export interface GraphPendingIndexSync {
  syncPendingIndex(opts?: GraphPendingIndexSyncOpts): Promise<{
    shards: number
    nodesUpserted: number
    edgesUpserted: number
    deleted: number
    skippedNoVaultId: number
  }>
}

function yieldEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate === 'function') {
      setImmediate(resolve)
    } else {
      setTimeout(resolve, 0)
    }
  })
}

const SYNC_YIELD_EVERY_ROWS = 50

function mergeSyncAliases(existing: string[], extra: string[]): string[] {
  const set = new Set<string>()
  for (const a of [...existing, ...extra]) {
    const n = a.trim().replace(/\s+/g, ' ')
    if (n) set.add(n)
  }
  return [...set]
}

function isExistingNodeIdenticalToRaw(
  existing: NonNullable<Awaited<ReturnType<GraphSyncApply['getNodeById']>>>,
  raw: GraphNodeRawRecord,
  fallbackShardMonth: string,
  embedding: number[] | null | undefined
): boolean {
  if (embedding !== undefined) return false
  if (existing.deletedAt != null || raw.deletedAt != null) return false
  if (existing.updatedAt !== raw.updatedAt) return false
  const normalizedName = raw.name.trim().replace(/\s+/g, ' ')
  if (existing.name !== normalizedName) return false
  if (existing.nodeType !== raw.nodeType) return false
  if ((existing.discriminator ?? '') !== normalizeGraphDiscriminator(raw.discriminator)) {
    return false
  }
  const mergedSummary = raw.summary || existing.summary || ''
  if (existing.summary !== mergedSummary) return false
  if (existing.mentionCount !== (raw.mentionCount ?? 1)) return false
  if (existing.reviewStatus !== (raw.reviewStatus ?? 'approved')) return false
  const targetShardMonth = raw.shardMonth || fallbackShardMonth || existing.shardMonth || ''
  if ((existing.shardMonth ?? '') !== targetShardMonth) return false
  if (existing.origin !== preferGraphOrigin(existing.origin, raw.origin)) return false
  if (existing.propsJson !== JSON.stringify(raw.props ?? {})) return false
  const mergedAliases =
    raw.origin === 'user'
      ? mergeSyncAliases([], [raw.name, ...(raw.aliases ?? [])])
      : mergeSyncAliases(existing.aliases ?? [], [raw.name, ...(raw.aliases ?? [])])
  if (
    mergedAliases.length !== (existing.aliases?.length ?? 0) ||
    mergedAliases.some((a, idx) => a !== existing.aliases[idx])
  ) {
    return false
  }
  return true
}

/**
 * pending-index → GraphRepository (file first, then SQLite).
 * Rows without vaultId are skipped and never participate in orphan sweeps.
 * Absence deletes only rows whose shardMonth file is present locally (or deleted by sync).
 */
export class GraphSyncService implements GraphPendingIndexSync {
  constructor(
    private readonly graphManager: GraphIndexSource,
    private readonly repo: GraphSyncApply,
    private readonly embedder?: GraphSyncEmbedder | null
  ) {}

  async syncPendingIndex(opts?: GraphPendingIndexSyncOpts): Promise<{
    shards: number
    nodesUpserted: number
    edgesUpserted: number
    deleted: number
    skippedNoVaultId: number
  }> {
    if (opts?.absentSweep !== 'off' && opts?.vaultId && this.graphManager.invalidateIndexedHashes) {
      const liveNodes =
        typeof this.repo.listLiveNodeRefs === 'function'
          ? await this.repo.listLiveNodeRefs(opts.vaultId)
          : []
      const liveEdges =
        typeof this.repo.listLiveEdgeRefs === 'function'
          ? await this.repo.listLiveEdgeRefs(opts.vaultId)
          : []
      if (liveNodes.length === 0 && liveEdges.length === 0) {
        await this.graphManager.invalidateIndexedHashes()
      }
    }

    const pending = await this.graphManager.listPendingIndex()
    let nodesUpserted = 0
    let edgesUpserted = 0
    let deleted = 0
    let skippedNoVaultId = 0
    const liveNodeIdsByVault = new Map<string, Set<string>>()
    const liveEdgeIdsByVault = new Map<string, Set<string>>()
    const syncedShardPaths = new Set<string>()
    const trackLiveIds = opts?.absentSweep !== 'off'

    for (const shard of pending) {
      const [collection] = shard.relativePath.split(/[/\\]/)
      if (collection === 'extract-state') {
        await this.graphManager.commitIndexed(collection, shard.relativePath, shard.contentHash)
        continue
      }

      const rows = collapseJsonlById(
        (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
          id: string
          vaultId?: string
          vaultName?: string
          updatedAt: number
          deletedAt?: number | null
        }>
      )

      if (trackLiveIds && (collection === 'nodes' || collection === 'edges')) {
        syncedShardPaths.add(shard.relativePath)
        const bucket = collection === 'nodes' ? liveNodeIdsByVault : liveEdgeIdsByVault
        for (const row of rows) {
          if (!row?.id || row.deletedAt != null) continue
          const vid = row.vaultId?.trim()
          if (vid && isVaultId(vid)) {
            let set = bucket.get(vid)
            if (!set) {
              set = new Set()
              bucket.set(vid, set)
            }
            set.add(row.id)
          }
        }
      }

      if (collection === 'nodes') {
        const existingByVaultAndId = new Map<
          string,
          Awaited<ReturnType<GraphSyncApply['getNodeById']>>
        >()
        if (typeof this.repo.getNodesByIds === 'function') {
          const idsByVault = new Map<string, string[]>()
          for (const raw of rows as GraphNodeRawRecord[]) {
            if (!raw?.id || raw.deletedAt != null) continue
            const vid = raw.vaultId?.trim()
            if (!vid || !isVaultId(vid)) continue
            let list = idsByVault.get(vid)
            if (!list) {
              list = []
              idsByVault.set(vid, list)
            }
            list.push(raw.id)
          }
          for (const [vid, ids] of idsByVault) {
            const existingRows = await this.repo.getNodesByIds(vid, ids)
            for (const row of existingRows) {
              existingByVaultAndId.set(`${vid}:${row.id}`, row)
            }
          }
        }

        let step = 0
        const batchQueue: Array<{
          raw: GraphNodeRawRecord
          vaultId: string
          row: NonNullable<Parameters<NonNullable<GraphSyncApply['applyRawNodesBatch']>>[0]>[number]
        }> = []
        const hasBatchApply = typeof this.repo.applyRawNodesBatch === 'function'
        const flushNodeBatch = async () => {
          if (batchQueue.length === 0) return
          const current = batchQueue.splice(0, batchQueue.length)
          if (hasBatchApply) {
            const appliedList = await this.repo.applyRawNodesBatch!(current.map((c) => c.row))
            for (let i = 0; i < current.length; i++) {
              const applied = appliedList[i]
              const item = current[i]!
              if (applied && applied.remappedFrom) {
                await this.writeBackUniqueMerge(item.raw, applied, item.vaultId)
              }
            }
          } else {
            for (const item of current) {
              const applied = await this.repo.applyRawNode(item.row)
              if (applied && applied.remappedFrom) {
                await this.writeBackUniqueMerge(item.raw, applied, item.vaultId)
              }
            }
          }
          nodesUpserted += current.length
        }

        for (const raw of rows as GraphNodeRawRecord[]) {
          if (!raw?.id) continue
          if (step > 0 && step % SYNC_YIELD_EVERY_ROWS === 0) {
            await flushNodeBatch()
            await yieldEventLoop()
          }
          step += 1
          const vaultId = raw.vaultId?.trim()
          if (!vaultId || !isVaultId(vaultId)) {
            skippedNoVaultId += 1
            continue
          }
          if (raw.deletedAt != null) {
            await flushNodeBatch()
            await this.repo.softDeleteNode(raw.id)
            deleted += 1
            continue
          }
          const cacheKey = `${vaultId}:${raw.id}`
          let embedding: number[] | null | undefined
          const cardText = graphNodeCardText(raw.name, raw.summary)
          const precomputed = opts?.precomputedNodeEmbeddings?.get(raw.id)
          const precomputedMatch = !!precomputed?.embedding.length && precomputed.text === cardText
          const existing = precomputedMatch
            ? typeof this.repo.getNodesByIds === 'function'
              ? (existingByVaultAndId.get(cacheKey) ?? null)
              : null
            : typeof this.repo.getNodesByIds === 'function'
              ? (existingByVaultAndId.get(cacheKey) ?? null)
              : typeof this.repo.getNodeById === 'function'
                ? await this.repo.getNodeById(raw.id, vaultId)
                : null
          if (precomputedMatch) {
            embedding = precomputed.embedding
          } else {
            // 已有向量且同模型时，还要名片文本一致才跳过；改名/改摘要必须按新名片重算。
            const reuseEmbed = shouldReuseGraphNodeEmbed({
              existing,
              incomingName: raw.name,
              incomingSummary: raw.summary,
              embedderModelId: this.embedder?.modelId
            })
            if (this.embedder?.embedQuery && !reuseEmbed) {
              try {
                embedding = await this.embedder.embedQuery(cardText)
              } catch {
                embedding = null
              }
            }
          }
          if (
            hasBatchApply &&
            existing &&
            isExistingNodeIdenticalToRaw(existing, raw, shard.shardMonth, embedding)
          ) {
            nodesUpserted += 1
            continue
          }
          batchQueue.push({
            raw,
            vaultId,
            row: {
              ...raw,
              vaultId,
              props: raw.props ?? {},
              shardMonth: raw.shardMonth || shard.shardMonth,
              embedding,
              modelId: this.embedder?.modelId,
              ...(hasBatchApply ? { existingById: existing } : {})
            }
          })
          if (batchQueue.length >= 35) {
            await flushNodeBatch()
          }
        }
        await flushNodeBatch()
      } else if (collection === 'edges') {
        let step = 0
        const edgeBatch: Array<Parameters<GraphSyncApply['applyRawEdge']>[0]> = []
        const flushEdgeBatch = async () => {
          if (edgeBatch.length === 0) return
          const current = edgeBatch.splice(0, edgeBatch.length)
          if (typeof this.repo.applyRawEdgesBatch === 'function') {
            await this.repo.applyRawEdgesBatch(current)
          } else {
            for (const item of current) {
              await this.repo.applyRawEdge(item)
            }
          }
          edgesUpserted += current.length
        }

        for (const raw of rows as GraphEdgeRawRecord[]) {
          if (!raw?.id) continue
          if (step > 0 && step % SYNC_YIELD_EVERY_ROWS === 0) {
            await flushEdgeBatch()
            await yieldEventLoop()
          }
          step += 1
          const vaultId = raw.vaultId?.trim()
          if (!vaultId || !isVaultId(vaultId)) {
            skippedNoVaultId += 1
            continue
          }
          if (raw.deletedAt != null) {
            await flushEdgeBatch()
            await this.repo.softDeleteEdge(raw.id)
            deleted += 1
            continue
          }
          edgeBatch.push({
            ...raw,
            vaultId,
            props: raw.props ?? {},
            isCurrent: raw.isCurrent ?? true,
            sourceExcerpt: raw.sourceExcerpt ?? '',
            confidence: raw.confidence ?? 100,
            validFrom: raw.validFrom ?? null,
            validTo: raw.validTo ?? null
          })
          if (edgeBatch.length >= 40) {
            await flushEdgeBatch()
          }
        }
        await flushEdgeBatch()
      }

      await this.graphManager.commitIndexed(collection!, shard.relativePath, shard.contentHash)
    }

    if (opts?.absentSweep === 'off') {
      return {
        shards: pending.length,
        nodesUpserted,
        edgesUpserted,
        deleted,
        skippedNoVaultId
      }
    }

    const nodeShardMonths: string[] = []
    const edgeShardMonths: string[] = []

    for (const shard of await this.graphManager.listShards()) {
      const [collection] = shard.relativePath.split(/[/\\]/)
      if (collection !== 'nodes' && collection !== 'edges') continue
      if (collection === 'nodes') nodeShardMonths.push(shard.shardMonth)
      else edgeShardMonths.push(shard.shardMonth)
      if (syncedShardPaths.has(shard.relativePath)) {
        continue
      }
      const bucket = collection === 'nodes' ? liveNodeIdsByVault : liveEdgeIdsByVault
      const rows = collapseJsonlById(
        (await this.graphManager.readShardRecords(shard.relativePath)) as Array<{
          id: string
          vaultId?: string
          updatedAt: number
          deletedAt?: number | null
        }>
      )
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        const vaultId = row.vaultId?.trim()
        if (!vaultId || !isVaultId(vaultId)) continue
        let set = bucket.get(vaultId)
        if (!set) {
          set = new Set()
          bucket.set(vaultId, set)
        }
        set.add(row.id)
      }
    }

    const presentNodes = collectPresentMonths({
      shardMonths: nodeShardMonths,
      deletedPaths: opts?.deletedShardPaths,
      collection: 'nodes'
    })
    const presentEdges = collectPresentMonths({
      shardMonths: edgeShardMonths,
      deletedPaths: opts?.deletedShardPaths,
      collection: 'edges'
    })

    const vaults = new Set<string>([...liveNodeIdsByVault.keys(), ...liveEdgeIdsByVault.keys()])
    const scopedVault = opts?.vaultId?.trim()
    if (scopedVault && isVaultId(scopedVault)) vaults.add(scopedVault)

    for (const vault of vaults) {
      const liveNodes = liveNodeIdsByVault.get(vault) ?? new Set<string>()
      const nodeRefs = await this.repo.listLiveNodeRefs(vault)
      for (const id of collectAbsentDeleteIds(nodeRefs, liveNodes, presentNodes)) {
        await this.repo.softDeleteNode(id)
        deleted += 1
      }
      const liveEdges = liveEdgeIdsByVault.get(vault) ?? new Set<string>()
      const edgeRefs = await this.repo.listLiveEdgeRefs(vault)
      for (const id of collectAbsentDeleteIds(edgeRefs, liveEdges, presentEdges)) {
        await this.repo.softDeleteEdge(id)
        deleted += 1
      }
    }

    return {
      shards: pending.length,
      nodesUpserted,
      edgesUpserted,
      deleted,
      skippedNoVaultId
    }
  }

  private async writeBackUniqueMerge(
    raw: GraphNodeRawRecord,
    applied: {
      id: string
      remappedFrom?: string
      remappedFromShardMonth?: string
      writeBackSurvivor?: boolean
    },
    vaultId: string
  ): Promise<void> {
    const loserId = applied.remappedFrom
    const loserMonth = applied.remappedFromShardMonth || raw.shardMonth
    if (loserId && loserMonth && this.graphManager.removeRecordsFromShard) {
      try {
        await this.graphManager.removeRecordsFromShard('nodes', loserMonth, [loserId])
      } catch {
        // Loser may only exist in SQLite
      }
    }
    if (!applied.writeBackSurvivor || !this.graphManager.writeRecord) return
    const live =
      typeof this.repo.getNodeById === 'function'
        ? await this.repo.getNodeById(applied.id, vaultId)
        : null
    const record: GraphNodeRawRecord = {
      ...raw,
      id: applied.id,
      vaultId,
      aliases: live?.aliases ?? raw.aliases ?? [],
      name: live?.name ?? raw.name,
      summary: live?.summary ?? raw.summary ?? '',
      shardMonth: live?.shardMonth || raw.shardMonth,
      deletedAt: null,
      updatedAt: Date.now()
    }
    if (!record.shardMonth) return
    try {
      await this.graphManager.writeRecord(record, { collection: 'nodes' })
    } catch {
      // File write-back is best-effort; SQLite already converged
    }
  }
}
