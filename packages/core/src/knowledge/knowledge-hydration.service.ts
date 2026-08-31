import { splitTextIntoChunks } from '@baishou/ai'
import {
  logger,
  notebookCoverImageCandidates,
  normalizeNotebookCoverIcon,
  normalizeNotebookCoverImage,
  normalizeNotebookCoverTone,
  type NotebookGraphExtractStateRawRecord
} from '@baishou/shared'
import type { KnowledgeRepository } from '@baishou/database/shared'
import { md5Hex } from '../fs/md5'
import type { NotebookRawManager } from '../raw-data/managers/notebook.raw-manager'
import {
  resolveHydrationGraphDecision,
  resolveHydrationSourceDecision
} from './knowledge-hydration-status.util'
import { notebookGraphDeletedShardPaths } from '../raw-data/notebook-graph-shard-key.util'
import type { NotebookGraphIndexService } from './notebook-graph-index.service'
import type { NotebookGraphRawManager } from './notebook-graph-raw.manager'

export interface KnowledgeHydrationResult {
  notebooksUpserted: number
  sourcesUpserted: number
  embedJobsEnqueued: number
  graphJobsEnqueued: number
  orphansCleaned: number
  skipped?: string
}

export interface KnowledgeHydrationDeps {
  repo: KnowledgeRepository
  notebookManager: NotebookRawManager
  /** 当前活跃仓库；orphan 与写入均按此过滤，禁止误清他仓 */
  vaultId: string
  /** 未配嵌入模型时仍同步结构层并清理 orphan，但不排 embed job */
  isEmbeddingConfigured: () => boolean
  /** 有则按 extract-state 差集排 graph job；缺省时有正文就排 */
  graphRaw?: NotebookGraphRawManager
  graphIndex?: Pick<NotebookGraphIndexService, 'syncPendingIndex'>
}

/**
 * 换端 / 同步后：磁盘 Notebooks/ ↔ knowledge.db 差集水合。
 * - 结构层（notebooks / sources）从 JSONL upsert 进库（带 vault_id）
 * - 有 extracted/*.md 且缺向量或 hash 变了 → 排 embed job
 * - DB 有、磁盘已无的 source → orphan 清理（仅当前 vault）
 * - 磁盘尚无 Notebooks 结构时不做 orphan 全清（避免空 vault 误删）
 */
export class KnowledgeHydrationService {
  constructor(private readonly deps: KnowledgeHydrationDeps) {}

  async hydrate(): Promise<KnowledgeHydrationResult> {
    const vaultId = this.deps.vaultId.trim()
    if (!vaultId) {
      logger.warn('[KnowledgeHydration] skip: vaultId empty')
      return {
        notebooksUpserted: 0,
        sourcesUpserted: 0,
        embedJobsEnqueued: 0,
        graphJobsEnqueued: 0,
        orphansCleaned: 0,
        skipped: 'vault-id-empty'
      }
    }

    const embeddingOk = this.deps.isEmbeddingConfigured()
    let notebooksUpserted = 0
    let sourcesUpserted = 0
    let embedJobsEnqueued = 0
    let graphJobsEnqueued = 0

    const diskNotebooks = await this.deps.notebookManager.listNotebookRecords()
    const liveSourceIds = new Set<string>()
    const liveNotebookIds = new Set<string>()

    for (const nb of diskNotebooks) {
      liveNotebookIds.add(nb.id)
      const existingNb = await this.deps.repo.getNotebook(nb.id)
      const diskHasSort =
        typeof nb.sortOrder === 'number' && Number.isFinite(nb.sortOrder)
      const diskHasTone = typeof nb.coverTone === 'string'
      const diskHasIcon = typeof nb.coverIcon === 'string'
      const diskHasImage = typeof nb.coverImage === 'string'
      const nextSort = diskHasSort ? nb.sortOrder : (existingNb?.sortOrder ?? 0)
      const nextTone = diskHasTone
        ? normalizeNotebookCoverTone(nb.coverTone)
        : (existingNb?.coverTone ?? '')
      const nextIcon = diskHasIcon
        ? normalizeNotebookCoverIcon(nb.coverIcon)
        : (existingNb?.coverIcon ?? '')
      let nextImage = diskHasImage
        ? normalizeNotebookCoverImage(nb.id, nb.coverImage)
        : (existingNb?.coverImage ?? '')
      if (!nextImage) {
        nextImage = await this.findCoverImageOnDisk(nb.id)
      }

      if (!existingNb) {
        await this.deps.repo.createNotebook({
          id: nb.id,
          name: nb.name,
          description: nb.description,
          vaultId,
          sortOrder: nextSort,
          coverTone: nextTone,
          coverIcon: nextIcon,
          coverImage: nextImage
        })
        notebooksUpserted += 1
      } else if (
        existingNb.name !== nb.name ||
        (existingNb.description ?? '') !== (nb.description ?? '') ||
        existingNb.vaultId !== vaultId ||
        (existingNb.sortOrder ?? 0) !== nextSort ||
        (existingNb.coverTone ?? '') !== nextTone ||
        (existingNb.coverIcon ?? '') !== nextIcon ||
        (existingNb.coverImage ?? '') !== nextImage
      ) {
        await this.deps.repo.updateNotebook(nb.id, {
          name: nb.name,
          description: nb.description,
          vaultId,
          sortOrder: nextSort,
          coverTone: nextTone,
          coverIcon: nextIcon,
          coverImage: nextImage
        })
        notebooksUpserted += 1
      }

      const extractStateBySource = await this.loadExtractStates(nb.id)
      const sources = await this.deps.notebookManager.listSourceRecords(nb.id)
      for (const src of sources) {
        liveSourceIds.add(src.id)
        const existing = await this.deps.repo.getSource(src.id)
        const extracted = await this.resolveExtracted(nb.id, src.id, existing)
        const extractedHash = extracted.hash
        const relativePath = this.resolveRelativePath(nb.id, src.path)
        const chunkCount = await this.deps.repo.countChunksBySource(src.id)
        const hashChanged =
          existing?.extractedTextHash != null &&
          extractedHash != null &&
          existing.extractedTextHash !== extractedHash
        const expectedChunkCount = await this.resolveExpectedChunkCount(
          nb.id,
          src.id,
          existing?.status,
          extracted
        )
        const decision = resolveHydrationSourceDecision({
          existingStatus: existing?.status,
          extractedHash,
          hashChanged,
          chunkCount,
          expectedChunkCount
        })

        await this.deps.repo.upsertSource({
          id: src.id,
          vaultId,
          notebookId: nb.id,
          title: src.title,
          sourceKind: src.kind || 'file',
          relativePath,
          contentHash: src.contentHash,
          extractedTextHash: extractedHash,
          extractEngine: src.extractEngine ?? 'simple',
          ...(src.pageCount != null ? { pageCount: src.pageCount } : {}),
          status: decision.status
        })
        sourcesUpserted += 1

        if (decision.needsEmbed && embeddingOk) {
          await this.deps.repo.updateSourceStatus(src.id, 'pending', {
            extractedTextHash: extractedHash,
            errorMessage: null
          })
          await this.deps.repo.enqueueIngestJob({
            notebookId: nb.id,
            sourceId: src.id,
            stage: 'embed',
            vaultId
          })
          embedJobsEnqueued += 1
        }

        if (
          resolveHydrationGraphDecision({
            extractedHash,
            extractState: extractStateBySource.get(src.id) ?? null
          })
        ) {
          await this.deps.repo.enqueueIngestJob({
            notebookId: nb.id,
            sourceId: src.id,
            stage: 'graph',
            vaultId
          })
          graphJobsEnqueued += 1
        }
      }
    }

    const orphansCleaned = await this.sweepOrphans(vaultId, liveSourceIds, liveNotebookIds)

    const result: KnowledgeHydrationResult = {
      notebooksUpserted,
      sourcesUpserted,
      embedJobsEnqueued,
      graphJobsEnqueued,
      orphansCleaned,
      skipped: embeddingOk ? undefined : 'embedding-not-configured'
    }

    logger.info('[KnowledgeHydration] done', { ...result, vaultId })
    return result
  }

  private async resolveExtracted(
    notebookId: string,
    sourceId: string,
    existing: { extractedTextHash?: string | null; updatedAt?: number } | null
  ): Promise<{ hash: string | null; text: string | null }> {
    const stat = await this.deps.notebookManager.statExtracted(notebookId, sourceId)
    if (!stat) return { hash: null, text: null }
    const stored = existing?.extractedTextHash?.trim() || null
    const updatedAt = Number(existing?.updatedAt ?? 0)
    if (stored && stat.mtimeMs != null && updatedAt > 0 && stat.mtimeMs <= updatedAt + 1000) {
      return { hash: stored, text: null }
    }
    const extracted = await this.deps.notebookManager.readExtractedText(notebookId, sourceId)
    const text = extracted?.trim() ? extracted : null
    return { hash: text ? md5Hex(extracted!) : null, text }
  }

  private async resolveExpectedChunkCount(
    notebookId: string,
    sourceId: string,
    existingStatus: string | undefined,
    extracted: { hash: string | null; text: string | null }
  ): Promise<number | undefined> {
    const status = (existingStatus ?? '').trim()
    if (status !== 'ready' && status !== 'partial' && status !== 'failed') return undefined
    if (!extracted.hash) return undefined
    let text = extracted.text
    if (!text) {
      const read = await this.deps.notebookManager.readExtractedText(notebookId, sourceId)
      text = read?.trim() ? read : null
    }
    if (!text) return undefined
    return splitTextIntoChunks(text).length
  }

  private async loadExtractStates(
    notebookId: string
  ): Promise<Map<string, NotebookGraphExtractStateRawRecord>> {
    const out = new Map<string, NotebookGraphExtractStateRawRecord>()
    if (!this.deps.graphRaw) return out
    const rows = await this.deps.graphRaw.readCollapsed<NotebookGraphExtractStateRawRecord>(
      notebookId,
      'extract-state'
    )
    for (const row of rows) {
      if (row.sourceId) out.set(row.sourceId, row)
    }
    return out
  }

  private resolveRelativePath(notebookId: string, pathFromJsonl?: string | null): string | null {
    if (!pathFromJsonl) return null
    const norm = pathFromJsonl.replace(/\\/g, '/').replace(/^\.\//, '')
    if (norm.startsWith(`${notebookId}/`)) return norm
    if (norm.includes('/')) return `${notebookId}/${norm}`
    return `${notebookId}/sources/${norm}`
  }

  /**
   * 仅清当前 vault 下、磁盘差集不可见的 orphan。
   * 禁止对全局 knowledge.db 在只看见当前 vault Notebooks 时全清。
   */
  private async sweepOrphans(
    vaultId: string,
    liveSourceIds: Set<string>,
    liveNotebookIds: Set<string>
  ): Promise<number> {
    // 磁盘无任何笔记本：可能尚未同步到 Notebooks/，不要清空本仓库
    if (liveNotebookIds.size === 0) return 0

    let cleaned = 0
    const dbSourceIds = await this.deps.repo.listDistinctSourceIds({ vaultId })
    for (const sourceId of dbSourceIds) {
      if (liveSourceIds.has(sourceId)) continue
      const source = await this.deps.repo.getSource(sourceId)
      if (this.deps.graphRaw && source?.notebookId) {
        await this.deps.graphRaw.deleteSourceShards(source.notebookId, sourceId)
      }
      await this.deps.repo.deleteSource(sourceId)
      if (this.deps.graphIndex && source?.notebookId) {
        await this.deps.graphIndex.syncPendingIndex({
          vaultId: source.vaultId?.trim() || vaultId,
          notebookId: source.notebookId,
          deletedShardPaths: notebookGraphDeletedShardPaths(source.notebookId, sourceId)
        })
      }
      cleaned += 1
    }

    const dbNotebooks = await this.deps.repo.listNotebooks({
      includeArchived: true,
      vaultId
    })
    for (const nb of dbNotebooks) {
      if (liveNotebookIds.has(nb.id)) continue
      await this.deps.repo.deleteNotebook(nb.id)
      cleaned += 1
    }
    return cleaned
  }

  private async findCoverImageOnDisk(notebookId: string): Promise<string> {
    for (const rel of notebookCoverImageCandidates(notebookId)) {
      try {
        if (await this.deps.notebookManager.existsRelative(rel)) return rel
      } catch {
        /* 越界或未实现时忽略 */
      }
    }
    return ''
  }
}
