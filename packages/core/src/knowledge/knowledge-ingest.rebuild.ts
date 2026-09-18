import type { KnowledgeIngestDeps } from './knowledge-ingest.types'
import { requireVaultId } from './knowledge-ingest.helpers'
import {
  markGraphExtractForce,
  markGraphFollowAfterEmbed,
  sourceHasChunkEmbeddings
} from './knowledge-ingest.jobs'

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
    const chunkVaultId = source.vaultId?.trim() || vaultId
    if (!(await sourceHasChunkEmbeddings(deps.repo, chunkVaultId, source.id))) {
      continue
    }
    markGraphExtractForce(source.id)
    await deps.repo.enqueueIngestJob({
      notebookId,
      sourceId: source.id,
      stage: 'graph',
      vaultId: chunkVaultId
    })
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
