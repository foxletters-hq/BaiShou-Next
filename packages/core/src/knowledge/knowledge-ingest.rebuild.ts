import type { KnowledgeIngestDeps } from './knowledge-ingest.types'
import { requireVaultId } from './knowledge-ingest.helpers'
import {
  markGraphExtractForce,
  markGraphFollowAfterEmbed,
  sourceHasChunkEmbeddings
} from './knowledge-ingest.jobs'

/**
 * 一键整理只补未完成的资料：没正文先抽；有正文没向量先嵌入并跟抽图。
 * 已嵌入的 ready/partial 视为完成，不在 FAB 路径重排图谱；图谱失败才重试。
 * 进行中的 extract/embed/graph 不重复入队。单份重整理走来源菜单。
 */
export function resolveNotebookOrganizeStage(source: {
  extractedTextHash?: string | null
  status?: string
  hasChunkEmbeddings?: boolean
  graphJobStatus?: string | null
}): 'extract' | 'embed' | 'graph' | null {
  if (source.status === 'extracting' || source.status === 'embedding') return null
  if (source.graphJobStatus === 'pending' || source.graphJobStatus === 'running') return null
  if (!source.extractedTextHash) return 'extract'
  if (!source.hasChunkEmbeddings) return 'embed'
  if (source.graphJobStatus === 'failed') return 'graph'
  if (source.status === 'ready' || source.status === 'partial') return null
  return 'graph'
}

export async function enqueueForcedGraph(
  deps: KnowledgeIngestDeps,
  source: { id: string; notebookId: string; vaultId?: string | null },
  vaultId: string
): Promise<'embed' | 'graph'> {
  const chunkVaultId = source.vaultId?.trim() || vaultId
  markGraphExtractForce(source.id)
  if (!(await sourceHasChunkEmbeddings(deps.repo, chunkVaultId, source.id))) {
    markGraphFollowAfterEmbed(source.id)
    await deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
    await deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId: source.id,
      stage: 'embed',
      vaultId: chunkVaultId
    })
    return 'embed'
  }
  await deps.repo.enqueueIngestJob({
    notebookId: source.notebookId,
    sourceId: source.id,
    stage: 'graph',
    vaultId: chunkVaultId
  })
  return 'graph'
}

export async function rebuildNotebookVectors(
  deps: KnowledgeIngestDeps,
  notebookId: string,
  options?: { followGraph?: boolean }
): Promise<number> {
  const vaultId = requireVaultId(deps.getVaultId)
  const sources = await deps.repo.listSources(notebookId)
  await deps.repo.deleteChunksByNotebook(notebookId)
  await deps.repo.rebuildEmbedLedger({ vaultId })
  let queued = 0
  for (const source of sources) {
    if (source.status === 'stored') continue
    if (!source.extractedTextHash && source.status === 'needs_ocr') continue
    await deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
    await deps.repo.enqueueIngestJob({
      notebookId,
      sourceId: source.id,
      stage: 'embed',
      vaultId: source.vaultId?.trim() || vaultId
    })
    if (options?.followGraph && source.extractedTextHash) {
      markGraphFollowAfterEmbed(source.id)
    }
    queued += 1
  }
  return queued
}

export async function rebuildIndex(deps: KnowledgeIngestDeps, notebookId: string): Promise<void> {
  const vaultId = requireVaultId(deps.getVaultId)
  const sources = await deps.repo.listSources(notebookId)
  await deps.repo.deleteChunksByNotebook(notebookId)
  await deps.repo.rebuildEmbedLedger({ vaultId })
  for (const source of sources) {
    if (source.status === 'stored') continue
    if (!source.extractedTextHash && source.status === 'needs_ocr') continue
    await deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
    await deps.repo.enqueueIngestJob({
      notebookId,
      sourceId: source.id,
      stage: 'embed',
      vaultId: source.vaultId?.trim() || vaultId
    })
    if (source.extractedTextHash) {
      markGraphFollowAfterEmbed(source.id)
    }
  }
}

export async function rebuildNotebookGraph(
  deps: KnowledgeIngestDeps,
  notebookId: string
): Promise<number> {
  const vaultId = requireVaultId(deps.getVaultId)
  const sources = await deps.repo.listSources(notebookId)
  let queued = 0
  for (const source of sources) {
    if (!source.extractedTextHash) continue
    await enqueueForcedGraph(deps, source, vaultId)
    queued += 1
  }
  return queued
}

export async function manageNotebookData(
  deps: KnowledgeIngestDeps,
  notebookId: string,
  input: { action: 'clear' | 'reprocess'; vector?: boolean; graph?: boolean }
): Promise<{
  action: 'clear' | 'reprocess'
  vector: boolean
  graph: boolean
  sourceCount: number
  vectorQueued: number
  graphQueued: number
}> {
  const id = String(notebookId || '').trim()
  if (!id) throw new Error('notebookId required')
  const vector = Boolean(input.vector)
  const graph = Boolean(input.graph)
  if (!vector && !graph) throw new Error('select at least one target')
  const action = input.action === 'clear' ? 'clear' : 'reprocess'
  const sources = await deps.repo.listSources(id)
  const sourceCount = sources.length

  if (action === 'clear') {
    if (vector) {
      const vaultId = requireVaultId(deps.getVaultId)
      await deps.repo.deleteChunksByNotebook(id)
      await deps.repo.rebuildEmbedLedger({ vaultId })
    }
    if (graph) {
      for (const source of sources) {
        await deps.deleteNotebookGraphSource?.({ notebookId: id, sourceId: source.id })
      }
      await deps.repo.clearNotebookGraph(id)
    }
    return { action, vector, graph, sourceCount, vectorQueued: 0, graphQueued: 0 }
  }

  const vectorQueued = vector ? await rebuildNotebookVectors(deps, id, { followGraph: graph }) : 0
  const graphQueued = graph ? (vector ? vectorQueued : await rebuildNotebookGraph(deps, id)) : 0
  return { action, vector, graph, sourceCount, vectorQueued, graphQueued }
}

export async function organizeNotebook(
  deps: KnowledgeIngestDeps,
  notebookId: string
): Promise<{ queued: number }> {
  const vaultId = requireVaultId(deps.getVaultId)
  const id = String(notebookId || '').trim()
  if (!id) throw new Error('notebookId required')
  const sources = await deps.repo.listSources(id)
  const graphJobs = await deps.repo.listIngestJobs({ notebookId: id, stage: 'graph' })
  const graphBySource = new Map(graphJobs.map((job) => [job.sourceId, job.status]))
  let queued = 0
  for (const source of sources) {
    const chunkVaultId = source.vaultId?.trim() || vaultId
    const hasChunkEmbeddings = source.extractedTextHash
      ? await sourceHasChunkEmbeddings(deps.repo, chunkVaultId, source.id)
      : false
    const stage = resolveNotebookOrganizeStage({
      ...source,
      hasChunkEmbeddings,
      graphJobStatus: graphBySource.get(source.id)
    })
    if (!stage) {
      const graphJobStatus = graphBySource.get(source.id)
      if (
        graphJobStatus === 'pending' ||
        graphJobStatus === 'running' ||
        source.status === 'extracting' ||
        source.status === 'embedding'
      ) {
        queued += 1
      }
      continue
    }
    if (stage !== 'graph') {
      await deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
    }
    await deps.repo.enqueueIngestJob({
      notebookId: id,
      sourceId: source.id,
      stage,
      vaultId: chunkVaultId
    })
    if (stage === 'embed') {
      markGraphFollowAfterEmbed(source.id)
    }
    queued += 1
  }
  return { queued }
}
