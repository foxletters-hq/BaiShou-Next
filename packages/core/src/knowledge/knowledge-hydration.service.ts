import { logger } from '@baishou/shared'
import type { KnowledgeRepository } from '@baishou/database/shared'
import { md5Hex } from '../fs/md5'
import type { NotebookRawManager } from '../raw-data/managers/notebook.raw-manager'

export interface KnowledgeHydrationResult {
  notebooksUpserted: number
  sourcesUpserted: number
  embedJobsEnqueued: number
  orphansCleaned: number
  skipped?: string
}

export interface KnowledgeHydrationDeps {
  repo: KnowledgeRepository
  notebookManager: NotebookRawManager
  /** 未配嵌入模型时仍同步结构层并清理 orphan，但不排 embed job */
  isEmbeddingConfigured: () => boolean
}

/**
 * 换端 / 同步后：磁盘 Notebooks/ ↔ knowledge.db 差集水合。
 * - 结构层（notebooks / sources）从 JSONL upsert 进库
 * - 有 extracted/*.md 且缺向量或 hash 变了 → 排 embed job
 * - DB 有、磁盘已无的 source → orphan 清理
 * - 磁盘尚无 Notebooks 结构时不做 orphan 全清（避免空 vault 误删）
 */
export class KnowledgeHydrationService {
  constructor(private readonly deps: KnowledgeHydrationDeps) {}

  async hydrate(): Promise<KnowledgeHydrationResult> {
    const embeddingOk = this.deps.isEmbeddingConfigured()
    let notebooksUpserted = 0
    let sourcesUpserted = 0
    let embedJobsEnqueued = 0

    const diskNotebooks = await this.deps.notebookManager.listNotebookRecords()
    const liveSourceIds = new Set<string>()
    const liveNotebookIds = new Set<string>()

    for (const nb of diskNotebooks) {
      liveNotebookIds.add(nb.id)
      const existingNb = await this.deps.repo.getNotebook(nb.id)
      if (!existingNb) {
        await this.deps.repo.createNotebook({
          id: nb.id,
          name: nb.name,
          description: nb.description
        })
        notebooksUpserted += 1
      } else if (
        existingNb.name !== nb.name ||
        (existingNb.description ?? '') !== (nb.description ?? '')
      ) {
        await this.deps.repo.updateNotebook(nb.id, {
          name: nb.name,
          description: nb.description
        })
        notebooksUpserted += 1
      }

      const sources = await this.deps.notebookManager.listSourceRecords(nb.id)
      for (const src of sources) {
        liveSourceIds.add(src.id)
        const existing = await this.deps.repo.getSource(src.id)
        const extracted = await this.deps.notebookManager.readExtractedText(nb.id, src.id)
        const extractedHash = extracted?.trim() ? md5Hex(extracted) : null
        const relativePath = this.resolveRelativePath(nb.id, src.path)

        await this.deps.repo.upsertSource({
          id: src.id,
          notebookId: nb.id,
          title: src.title,
          sourceKind: src.kind || 'file',
          relativePath,
          contentHash: src.contentHash,
          extractedTextHash: extractedHash,
          extractEngine: src.extractEngine ?? 'simple',
          pageCount: src.pageCount ?? null,
          status: existing?.status === 'ready' && extractedHash ? 'ready' : extractedHash ? 'pending' : 'pending'
        })
        sourcesUpserted += 1

        if (!extractedHash) continue

        const chunks = await this.deps.repo.listChunksBySource(src.id)
        const hashChanged =
          existing?.extractedTextHash != null && existing.extractedTextHash !== extractedHash
        const needsEmbed = chunks.length === 0 || hashChanged

        if (!needsEmbed) {
          if (existing?.status !== 'ready') {
            await this.deps.repo.updateSourceStatus(src.id, 'ready', {
              extractedTextHash: extractedHash,
              errorMessage: null
            })
          }
          continue
        }

        if (!embeddingOk) continue

        await this.deps.repo.updateSourceStatus(src.id, 'pending', {
          extractedTextHash: extractedHash,
          errorMessage: null
        })
        await this.deps.repo.enqueueIngestJob({
          notebookId: nb.id,
          sourceId: src.id,
          stage: 'embed'
        })
        embedJobsEnqueued += 1
      }
    }

    const orphansCleaned = await this.sweepOrphans(liveSourceIds, liveNotebookIds)

    const result: KnowledgeHydrationResult = {
      notebooksUpserted,
      sourcesUpserted,
      embedJobsEnqueued,
      orphansCleaned,
      skipped: embeddingOk ? undefined : 'embedding-not-configured'
    }

    logger.info('[KnowledgeHydration] done', result)
    return result
  }

  private resolveRelativePath(notebookId: string, pathFromJsonl?: string | null): string | null {
    if (!pathFromJsonl) return null
    const norm = pathFromJsonl.replace(/\\/g, '/').replace(/^\.\//, '')
    if (norm.startsWith(`${notebookId}/`)) return norm
    if (norm.includes('/')) return `${notebookId}/${norm}`
    return `${notebookId}/sources/${norm}`
  }

  private async sweepOrphans(
    liveSourceIds: Set<string>,
    liveNotebookIds: Set<string>
  ): Promise<number> {
    // 磁盘无任何笔记本：可能尚未同步到 Notebooks/，不要清空本地库
    if (liveNotebookIds.size === 0) return 0

    let cleaned = 0
    const dbSourceIds = await this.deps.repo.listDistinctSourceIds()
    for (const sourceId of dbSourceIds) {
      if (liveSourceIds.has(sourceId)) continue
      await this.deps.repo.deleteSource(sourceId)
      cleaned += 1
    }

    const dbNotebooks = await this.deps.repo.listNotebooks({ includeArchived: true })
    for (const nb of dbNotebooks) {
      if (liveNotebookIds.has(nb.id)) continue
      await this.deps.repo.deleteNotebook(nb.id)
      cleaned += 1
    }
    return cleaned
  }
}
