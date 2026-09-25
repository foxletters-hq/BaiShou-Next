import type { KnowledgeImportProcessMode } from '@baishou/shared'
import type { ExtractResult } from './knowledge-extract'
import type { ExtractEngineId } from './extract-engines'
import type { KnowledgeExtractOverride, KnowledgeIngestDeps } from './knowledge-ingest.types'
import { processEmbedJob, processGraphJob } from './knowledge-ingest.embed'
import { processExtractJob } from './knowledge-ingest.extract'
import {
  createNotebook,
  deleteNotebook,
  listNotebooks,
  reorderNotebooks,
  setCoverImage,
  updateNotebook
} from './knowledge-ingest.notebook'
import {
  manageNotebookData,
  organizeNotebook,
  rebuildIndex,
  rebuildNotebookGraph,
  rebuildNotebookVectors
} from './knowledge-ingest.rebuild'
import {
  cancelExtract,
  deleteSource,
  importSource,
  ocrMissingPages,
  recoverStaleIngestState,
  reprocessSource,
  retrySource
} from './knowledge-ingest.source'

export type {
  KnowledgeExtractConfig,
  KnowledgeExtractProgress,
  KnowledgeIngestDeps,
  KnowledgeIngestEmbeddingConfig
} from './knowledge-ingest.types'
export {
  KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR,
  listLiveGraphSourceIds,
  markEmbedJobLive,
  markExtractJobLive,
  markGraphFollowAfterEmbed,
  markGraphJobLive,
  unmarkEmbedJobLive,
  unmarkExtractJobLive,
  unmarkGraphJobLive
} from './knowledge-ingest.jobs'

/**
 * 知识库摄入编排：extract → embed 两段 job；磁盘先落定再灌库。
 * 图任务只在 embed 成功后由 follow 标记入队。
 */
export class KnowledgeIngestService {
  constructor(private readonly deps: KnowledgeIngestDeps) {}

  async createNotebook(input: {
    name: string
    description?: string
    id?: string
    coverTone?: string
    coverIcon?: string
  }) {
    return createNotebook(this.deps, input)
  }

  async listNotebooks() {
    return listNotebooks(this.deps)
  }

  async updateNotebook(input: {
    notebookId: string
    name?: string
    description?: string
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }) {
    return updateNotebook(this.deps, input)
  }

  async setCoverImage(input: { notebookId: string; absolutePath: string }) {
    return setCoverImage(this.deps, input)
  }

  async reorderNotebooks(orderedIds: string[]) {
    return reorderNotebooks(this.deps, orderedIds)
  }

  async deleteNotebook(notebookId: string): Promise<void> {
    return deleteNotebook(this.deps, notebookId)
  }

  async importSource(input: {
    notebookId: string
    title: string
    kind: 'file' | 'text' | 'url' | 'note'
    absolutePath?: string
    textContent?: string
    fileName?: string
    originUrl?: string
    extractEngine?: ExtractEngineId
    importProcessMode?: KnowledgeImportProcessMode | string
  }): Promise<{ sourceId: string }> {
    return importSource(this.deps, input)
  }

  async deleteSource(sourceId: string): Promise<void> {
    return deleteSource(this.deps, sourceId)
  }

  async retrySource(sourceId: string): Promise<void> {
    return retrySource(this.deps, sourceId)
  }

  async reprocessSource(sourceId: string, target: 'embed' | 'graph'): Promise<void> {
    return reprocessSource(this.deps, sourceId, target)
  }

  async ocrMissingPages(
    sourceId: string,
    options?: {
      engine?: ExtractEngineId
      pageNumbers?: number[]
    }
  ): Promise<{ queued: true }> {
    return ocrMissingPages(this.deps, sourceId, options)
  }

  async cancelExtract(sourceId: string): Promise<{ cancelled: true; status: string }> {
    return cancelExtract(this.deps, sourceId)
  }

  async recoverStaleIngestState(options?: { olderThanMs?: number }) {
    return recoverStaleIngestState(this.deps, options)
  }

  async rebuildNotebookVectors(notebookId: string, options?: { followGraph?: boolean }) {
    return rebuildNotebookVectors(this.deps, notebookId, options)
  }

  async rebuildIndex(notebookId: string): Promise<void> {
    return rebuildIndex(this.deps, notebookId)
  }

  async manageNotebookData(
    notebookId: string,
    input: { action: 'clear' | 'reprocess'; vector?: boolean; graph?: boolean }
  ) {
    return manageNotebookData(this.deps, notebookId, input)
  }

  async rebuildNotebookGraph(notebookId: string): Promise<number> {
    return rebuildNotebookGraph(this.deps, notebookId)
  }

  async organizeNotebook(notebookId: string): Promise<{ queued: number }> {
    return organizeNotebook(this.deps, notebookId)
  }

  async processExtractJob(
    sourceId: string,
    override?: KnowledgeExtractOverride
  ): Promise<ExtractResult> {
    return processExtractJob(this.deps, sourceId, override)
  }

  async processGraphJob(sourceId: string): Promise<void> {
    return processGraphJob(this.deps, sourceId)
  }

  async processEmbedJob(sourceId: string): Promise<void> {
    return processEmbedJob(this.deps, sourceId)
  }
}
