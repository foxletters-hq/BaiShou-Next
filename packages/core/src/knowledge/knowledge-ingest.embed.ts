import { splitTextIntoChunks } from '@baishou/ai'
import { hashEmbedSourceContent, logger } from '@baishou/shared'
import type { KnowledgeIngestDeps } from './knowledge-ingest.types'
import { requireVaultId } from './knowledge-ingest.helpers'
import {
  clearGraphExtractForce,
  KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR,
  peekGraphExtractForce,
  sourceHasChunkEmbeddings,
  takeGraphFollowAfterEmbed
} from './knowledge-ingest.jobs'

export async function processGraphJob(deps: KnowledgeIngestDeps, sourceId: string): Promise<void> {
  const vaultId = requireVaultId(deps.getVaultId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)
  const chunkVaultId = source.vaultId?.trim() || vaultId
  if (!(await sourceHasChunkEmbeddings(deps.repo, chunkVaultId, sourceId))) {
    throw new Error(KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR)
  }
  const text = await deps.notebookManager.readExtractedText(source.notebookId, sourceId)
  if (!text?.trim()) {
    throw new Error('extracted text missing')
  }
  if (!deps.extractNotebookGraph) {
    throw new Error('graph-extract-not-configured')
  }
  const pages = await deps.notebookManager.readPagesJson(source.notebookId, sourceId)
  const force = peekGraphExtractForce(sourceId)
  try {
    await deps.extractNotebookGraph({
      vaultId: source.vaultId?.trim() || vaultId,
      notebookId: source.notebookId,
      sourceId,
      sourceTitle: source.title,
      text,
      textHash: source.extractedTextHash || '',
      pages: pages?.pages ?? null,
      force
    })
    clearGraphExtractForce(sourceId)
  } catch (error) {
    if (!force) clearGraphExtractForce(sourceId)
    throw error
  }
}

export async function processEmbedJob(deps: KnowledgeIngestDeps, sourceId: string): Promise<void> {
  const vaultId = requireVaultId(deps.getVaultId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)
  const chunkVaultId = source.vaultId?.trim() || vaultId

  const text = await deps.notebookManager.readExtractedText(source.notebookId, sourceId)
  if (!text?.trim()) {
    await deps.repo.recordEmbedFailure({
      vaultId: chunkVaultId,
      sourceId,
      lastError: 'extracted text missing',
      chunkCount: 0
    })
    await deps.repo.updateSourceStatus(sourceId, 'failed', {
      errorMessage: 'extracted text missing'
    })
    throw new Error('extracted text missing')
  }

  const embeddingCfg = deps.embedding
  if (!embeddingCfg?.isConfigured && !deps.embedText) {
    throw new Error('embedding-not-configured')
  }

  await deps.repo.updateSourceStatus(sourceId, 'embedding')

  const modelId = embeddingCfg?.getModelId() ?? 'mock'
  const chunks = splitTextIntoChunks(text)
  let charCursor = 0
  let lastDimension = 0
  deps.onExtractProgress?.({
    sourceId,
    page: 0,
    total: chunks.length,
    phase: 'embed'
  })

  try {
    for (const chunk of chunks) {
      let vector: number[]
      if (deps.embedText) {
        vector = await deps.embedText(chunk.text, modelId)
      } else {
        const provider = await embeddingCfg!.getProviderInstance()
        if (!provider) throw new Error('embedding provider unavailable')
        const { embed } = await import('ai')
        const aiModel = provider.getEmbeddingModel(modelId) as never
        const { embedding } = await embed({ model: aiModel, value: chunk.text })
        vector = Array.from(embedding)
      }
      lastDimension = vector.length

      const offset = text.indexOf(chunk.text, charCursor)
      const resolvedOffset = offset >= 0 ? offset : charCursor
      charCursor = resolvedOffset + chunk.text.length

      await deps.insertChunk({
        chunkId: `${sourceId}_${chunk.index}`,
        notebookId: source.notebookId,
        sourceId,
        chunkIndex: chunk.index,
        chunkText: chunk.text,
        metadataJson: JSON.stringify({
          offset: resolvedOffset,
          len: chunk.text.length,
          chunker: 'tiktoken-1024-128'
        }),
        embedding: vector,
        modelId,
        vaultId: chunkVaultId
      })
      deps.onExtractProgress?.({
        sourceId,
        page: chunk.index + 1,
        total: chunks.length,
        phase: 'embed'
      })
    }

    await deps.repo.deleteChunksBySourceFromIndex(sourceId, chunks.length)

    await deps.repo.recordEmbedded({
      vaultId: chunkVaultId,
      sourceId,
      contentHash: hashEmbedSourceContent(text),
      chunkCount: chunks.length,
      modelId,
      dimension: lastDimension
    })
  } catch (error) {
    await deps.repo.recordEmbedFailure({
      vaultId: chunkVaultId,
      sourceId,
      lastError: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
    })
    throw error
  }

  const pageCount = source.pageCount
  const textPageCount = source.textPageCount
  const isPdfLike =
    source.sourceKind === 'file' && (source.relativePath || '').toLowerCase().endsWith('.pdf')

  // 页数未知禁止标 ready（尤其 PDF）
  if (isPdfLike && (pageCount == null || pageCount <= 0)) {
    await deps.repo.updateSourceStatus(sourceId, 'needs_ocr', {
      errorMessage: '页数未知，禁止标 ready'
    })
    logger.info('[KnowledgeIngest] embed done but pageCount unknown → needs_ocr', {
      sourceId
    })
    await enqueueGraphFollowIfNeeded(deps, source, vaultId, sourceId)
    return
  }

  const stillPartial =
    pageCount != null && textPageCount != null && pageCount > 0 && textPageCount / pageCount < 0.9

  await deps.repo.updateSourceStatus(sourceId, stillPartial ? 'partial' : 'ready', {
    errorMessage: stillPartial ? source.errorMessage : null
  })

  logger.info('[KnowledgeIngest] embed done', { sourceId, chunks: chunks.length })
  await enqueueGraphFollowIfNeeded(deps, source, vaultId, sourceId)
}

async function enqueueGraphFollowIfNeeded(
  deps: KnowledgeIngestDeps,
  source: { notebookId: string; vaultId?: string | null },
  vaultId: string,
  sourceId: string
): Promise<void> {
  if (!takeGraphFollowAfterEmbed(sourceId)) return
  const latest = await deps.repo.getSource(sourceId)
  if (!latest || latest.errorMessage === 'cancelled') return
  await deps.repo.enqueueIngestJob({
    notebookId: source.notebookId,
    sourceId,
    stage: 'graph',
    vaultId: source.vaultId?.trim() || vaultId
  })
}
