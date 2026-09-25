import {
  knowledgeImportProcessTargets,
  logger,
  normalizeKnowledgeImportProcessMode,
  shouldDeferKnowledgeImportOrganize
} from '@baishou/shared'
import type { KnowledgeImportProcessMode } from '@baishou/shared'
import * as path from '../fs/path.util'
import type { ExtractEngineId } from './extract-engines'
import type { KnowledgeIngestDeps } from './knowledge-ingest.types'
import { byteLengthUtf8, newId, requireVaultId } from './knowledge-ingest.helpers'
import {
  clearGraphExtractForce,
  clearGraphFollowAfterEmbed,
  isExtractProtected,
  KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR,
  listLiveIngestSourceIds,
  markGraphExtractForce,
  markGraphFollowAfterEmbed,
  rememberProcessTargets,
  requestExtractAbort,
  resolveStatusAfterCancel,
  setPendingExtractOverride,
  sourceHasChunkEmbeddings
} from './knowledge-ingest.jobs'

export async function importSource(
  deps: KnowledgeIngestDeps,
  input: {
    notebookId: string
    title: string
    kind: 'file' | 'text' | 'url' | 'note'
    absolutePath?: string
    textContent?: string
    fileName?: string
    originUrl?: string
    extractEngine?: ExtractEngineId
    /** 导入后处理：向量、向量和图关系，或稍后整理。旧值 graph 按 both 走。 */
    importProcessMode?: KnowledgeImportProcessMode | string
  }
): Promise<{ sourceId: string }> {
  const vaultId = requireVaultId(deps.getVaultId)
  const notebook = await deps.repo.getNotebook(input.notebookId)
  if (!notebook) throw new Error(`notebook not found: ${input.notebookId}`)
  if (notebook.vaultId && notebook.vaultId !== vaultId) {
    throw new Error(`notebook belongs to another vault: ${input.notebookId}`)
  }

  const sourceId = newId(input.kind === 'note' ? 'note' : 'src')
  const now = Date.now()
  let relativePath: string | null = null
  let contentHash = ''
  let byteSize = 0
  const fileName = input.fileName || input.title
  let originUrl: string | null = input.originUrl ?? null
  const extractEngine = input.extractEngine ?? 'simple'
  const sourceKind = input.kind === 'note' ? 'note' : input.kind
  const rawImportProcessMode = String(input.importProcessMode ?? '').trim()
  const importProcessMode = normalizeKnowledgeImportProcessMode(input.importProcessMode)
  const processTargets = knowledgeImportProcessTargets(importProcessMode)
  const deferOrganize =
    shouldDeferKnowledgeImportOrganize(importProcessMode) ||
    rawImportProcessMode === 'later' ||
    rawImportProcessMode === 'none' ||
    rawImportProcessMode === 'save-only'

  if (input.kind === 'file') {
    if (!input.absolutePath) throw new Error('import file requires absolutePath')
    const safeName = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    relativePath = path.join(input.notebookId, 'sources', `${sourceId}_${safeName}`)
    const written = await deps.notebookManager.copySourceFile(relativePath, input.absolutePath)
    contentHash = written.contentHash
    try {
      const abs = await deps.notebookManager.absolutePath(relativePath)
      const st = await deps.fs.stat(abs)
      byteSize = st.size ?? 0
    } catch {
      byteSize = 0
    }
  } else if (input.kind === 'url') {
    const text = input.textContent ?? ''
    if (!text.trim()) throw new Error('import url requires textContent')
    if (!originUrl?.trim()) throw new Error('import url requires originUrl')
    originUrl = originUrl.trim()
    const safeName = `${sourceId}.md`
    relativePath = path.join(input.notebookId, 'sources', safeName)
    const written = await deps.notebookManager.writeFile(relativePath, text, {
      skipVersion: true
    })
    contentHash = written.contentHash
    byteSize = byteLengthUtf8(text)
  } else {
    const text = input.textContent ?? ''
    const safeName = `${sourceId}.${input.kind === 'note' ? 'md' : 'txt'}`
    relativePath = path.join(input.notebookId, 'sources', safeName)
    const written = await deps.notebookManager.writeFile(relativePath, text, {
      skipVersion: true
    })
    contentHash = written.contentHash
    byteSize = byteLengthUtf8(text)
  }

  await deps.repo.upsertSource({
    id: sourceId,
    vaultId,
    notebookId: input.notebookId,
    title: input.title,
    sourceKind,
    relativePath,
    originUrl,
    contentHash,
    status: deferOrganize || !processTargets.extract ? 'stored' : 'pending',
    byteSize,
    extractEngine
  })

  await deps.notebookManager.appendSourceRecord(input.notebookId, {
    id: sourceId,
    title: input.title,
    kind: sourceKind,
    path: relativePath ? relativePath.replace(/\\/g, '/').split('/').slice(-2).join('/') : null,
    originUrl,
    contentHash,
    extractEngine,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  })

  if (deferOrganize || !processTargets.extract) {
    logger.info('[KnowledgeIngest] import stored for later organize', {
      sourceId,
      importProcessMode
    })
    return { sourceId }
  }

  rememberProcessTargets(sourceId, {
    embed: processTargets.embed,
    graph: processTargets.graph
  })
  await deps.repo.enqueueIngestJob({
    notebookId: input.notebookId,
    sourceId,
    stage: 'extract',
    vaultId
  })

  return { sourceId }
}

export async function deleteSource(deps: KnowledgeIngestDeps, sourceId: string): Promise<void> {
  requestExtractAbort(sourceId)
  clearGraphFollowAfterEmbed(sourceId)
  clearGraphExtractForce(sourceId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)
  const now = Date.now()

  const unlinkRel = async (relativePath: string | null | undefined) => {
    if (!relativePath) return
    try {
      const abs = await deps.notebookManager.absolutePath(relativePath)
      if (await deps.fs.exists(abs)) await deps.fs.unlink(abs)
    } catch {
      /* 文件缺失不拦删除 */
    }
  }

  await unlinkRel(source.relativePath)
  await unlinkRel(path.join(source.notebookId, 'extracted', `${sourceId}.md`))
  await unlinkRel(path.join(source.notebookId, 'extracted', `${sourceId}.pages.json`))

  await deps.notebookManager.appendSourceRecord(source.notebookId, {
    id: source.id,
    title: source.title,
    kind: source.sourceKind,
    path: source.relativePath
      ? source.relativePath.replace(/\\/g, '/').split('/').slice(-2).join('/')
      : null,
    originUrl: source.originUrl,
    contentHash: source.contentHash,
    extractEngine: source.extractEngine,
    pageCount: source.pageCount,
    createdAt: source.createdAt,
    updatedAt: now,
    deletedAt: now
  })

  if (deps.deleteNotebookGraphSource) {
    try {
      await deps.deleteNotebookGraphSource({
        notebookId: source.notebookId,
        sourceId
      })
    } catch {
      /* 图谱分片缺失不拦删除 */
    }
  }

  await deps.repo.deleteSource(sourceId)
}

export async function retrySource(deps: KnowledgeIngestDeps, sourceId: string): Promise<void> {
  const vaultId = requireVaultId(deps.getVaultId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)
  const stage = source.extractedTextHash ? 'embed' : 'extract'
  await deps.repo.updateSourceStatus(sourceId, 'pending', { errorMessage: null })
  await deps.repo.enqueueIngestJob({
    notebookId: source.notebookId,
    sourceId,
    stage,
    vaultId: source.vaultId?.trim() || vaultId
  })
  if (source.extractedTextHash) {
    markGraphFollowAfterEmbed(sourceId)
  }
}

export async function reprocessSource(
  deps: KnowledgeIngestDeps,
  sourceId: string,
  target: 'embed' | 'graph'
): Promise<void> {
  const vaultId = requireVaultId(deps.getVaultId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)
  if (!source.extractedTextHash) {
    throw new Error('extracted text missing')
  }
  if (target === 'embed') {
    await deps.repo.updateSourceStatus(sourceId, 'pending', { errorMessage: null })
    await deps.repo.enqueueIngestJob({
      notebookId: source.notebookId,
      sourceId,
      stage: 'embed',
      vaultId: source.vaultId?.trim() || vaultId
    })
    return
  }
  const chunkVaultId = source.vaultId?.trim() || vaultId
  if (!(await sourceHasChunkEmbeddings(deps.repo, chunkVaultId, sourceId))) {
    throw new Error(KNOWLEDGE_SOURCE_NOT_EMBEDDED_ERROR)
  }
  markGraphExtractForce(sourceId)
  await deps.repo.enqueueIngestJob({
    notebookId: source.notebookId,
    sourceId,
    stage: 'graph',
    vaultId: chunkVaultId
  })
}

export async function ocrMissingPages(
  deps: KnowledgeIngestDeps,
  sourceId: string,
  options?: {
    engine?: ExtractEngineId
    pageNumbers?: number[]
  }
): Promise<{ queued: true }> {
  const vaultId = requireVaultId(deps.getVaultId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)

  const engine = options?.engine ?? 'ocr'
  await deps.repo.updateSourceStatus(sourceId, 'pending', {
    errorMessage: null,
    extractEngine: engine
  })
  setPendingExtractOverride(sourceId, {
    forceEngine: engine,
    pageNumbers: options?.pageNumbers,
    onlyMissingPages: !options?.pageNumbers?.length
  })
  await deps.repo.enqueueIngestJob({
    notebookId: source.notebookId,
    sourceId,
    stage: 'extract',
    vaultId: source.vaultId?.trim() || vaultId
  })
  return { queued: true }
}

export async function cancelExtract(
  deps: KnowledgeIngestDeps,
  sourceId: string
): Promise<{ cancelled: true; status: string }> {
  requestExtractAbort(sourceId)
  clearGraphFollowAfterEmbed(sourceId)
  clearGraphExtractForce(sourceId)
  const source = await deps.repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)

  await deps.repo.deleteIngestJobsForSource(sourceId)
  if (source.status === 'embedding') {
    await deps.repo.updateSourceStatus(sourceId, 'failed', {
      errorMessage: 'cancelled'
    })
    return { cancelled: true, status: 'failed' }
  }
  const status = resolveStatusAfterCancel(source)
  await deps.repo.updateSourceStatus(sourceId, status, {
    errorMessage: status === 'failed' ? 'cancelled' : null
  })
  return { cancelled: true, status }
}

/** 只把卡住的提取恢复成 pending，不重新入队；由用户在笔记本里点重试或开始整理。 */
export async function recoverStaleIngestState(
  deps: KnowledgeIngestDeps,
  options?: { olderThanMs?: number }
): Promise<{
  resetSources: number
  reclaimedEmbedJobs: number
  droppedExtractJobs: number
}> {
  const vaultId = deps.getVaultId()?.trim()
  if (!vaultId) {
    return { resetSources: 0, reclaimedEmbedJobs: 0, droppedExtractJobs: 0 }
  }

  const reclaimedEmbedJobs = await deps.repo.reclaimStaleRunningIngestJobs({
    olderThanMs: options?.olderThanMs,
    vaultId,
    excludeSourceIds: listLiveIngestSourceIds()
  })

  let resetSources = 0
  const extracting = await deps.repo.listSourcesByStatus('extracting', { vaultId })
  const extractJobs =
    extracting.length > 0 ? await deps.repo.listIngestJobs({ vaultId, stage: 'extract' }) : []
  const runningExtract = new Set(
    extractJobs.filter((job) => job.status === 'running').map((job) => job.sourceId)
  )
  for (const source of extracting) {
    if (isExtractProtected(source.id)) continue
    if (runningExtract.has(source.id)) continue
    await deps.repo.updateSourceStatus(source.id, 'pending', { errorMessage: null })
    resetSources += 1
  }

  return { resetSources, reclaimedEmbedJobs, droppedExtractJobs: 0 }
}
