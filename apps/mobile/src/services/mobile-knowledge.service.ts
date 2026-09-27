import {
  normalizeKnowledgeImportProcessMode,
  parseMountedNotebookIds,
  shouldDeferKnowledgeImportOrganize,
  type KnowledgeImportProcessMode
} from '@baishou/shared'
import { expoKnowledgeConnectionManager } from '@baishou/database/expo'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import {
  ensureMobileRawDataRuntime,
  getMobileNotebookRawManager,
  resolveMobileEmbeddingForHydration
} from './mobile-raw-data-source.runtime'
import { createMobileFileSystem } from './create-mobile-file-system'
import {
  requireMobileKnowledgeRepo as requireRepo,
  resolveMobileActiveVaultId
} from './mobile-knowledge-repo'

export { resolveMobileActiveVaultId } from './mobile-knowledge-repo'
export { mobileListMountSummaries } from './mobile-knowledge-mount.service'

export async function mobileListNotebooks() {
  return requireRepo().listNotebooks({ vaultId: await resolveMobileActiveVaultId() })
}

export async function mobileListSources(notebookId: string) {
  return requireRepo().listSources(notebookId)
}

export async function mobileDeleteSource(sourceId: string): Promise<void> {
  const id = sourceId.trim()
  if (!id) throw new Error('sourceId required')
  const svc = await buildMobileIngestService()
  await svc.deleteSource(id)
}

export async function mobileGetKnowledgeStats(notebookId?: string) {
  return requireRepo().getStats(notebookId, await resolveMobileActiveVaultId())
}

export async function mobileListNotebookStats() {
  return requireRepo().listNotebookStats(await resolveMobileActiveVaultId())
}

export async function mobileHasKnowledgeModelMismatch(notebookIds?: string[]): Promise<boolean> {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager) return false
  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  if (!emb.embeddingModelId) return false
  const ids = parseMountedNotebookIds(notebookIds)
  const count = await requireRepo().countHeterogeneousEmbeddings(emb.embeddingModelId, {
    vaultId: await resolveMobileActiveVaultId(),
    ...(ids.length > 0 ? { notebookIds: ids } : {})
  })
  return count > 0
}

async function kickMobileKnowledgeIngest(reason: string): Promise<void> {
  const { scheduleConsumeMobileKnowledgeIngestJobs } =
    await import('./mobile-knowledge-ingest-jobs.consumer')
  scheduleConsumeMobileKnowledgeIngestJobs(reason)
}

export async function mobileRebuildKnowledgeIndex(notebookId: string): Promise<void> {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const svc = await buildMobileIngestService()
  // 走 core rebuildIndex：重建 ledger、跳过 stored、embed 后跟抽图
  await svc.rebuildIndex(id)
  await kickMobileKnowledgeIngest('mobile-rebuild')
}

export async function mobileRetrySource(sourceId: string): Promise<void> {
  const id = sourceId.trim()
  if (!id) throw new Error('sourceId required')
  const svc = await buildMobileIngestService()
  await svc.retrySource(id)
  await kickMobileKnowledgeIngest('mobile-retry-source')
}

export async function mobileReprocessSource(
  sourceId: string,
  target: 'embed' | 'graph'
): Promise<void> {
  const id = sourceId.trim()
  if (!id) throw new Error('sourceId required')
  const svc = await buildMobileIngestService()
  await svc.reprocessSource(id, target)
  await kickMobileKnowledgeIngest(
    target === 'graph' ? 'mobile-reprocess-graph' : 'mobile-reprocess-embed'
  )
}

export async function mobileRebuildNotebookGraph(notebookId: string): Promise<number> {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const svc = await buildMobileIngestService()
  const queued = await svc.rebuildNotebookGraph(id)
  await kickMobileKnowledgeIngest('mobile-rebuild-graph')
  return queued
}

async function buildMobileIngestService() {
  const runtime = agentDbRuntimeRef.current
  if (!runtime?.settingsManager || !runtime.pathService) {
    throw new Error('runtime not ready')
  }
  if (!expoKnowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }

  const emb = await resolveMobileEmbeddingForHydration(runtime.settingsManager)
  const fileSystem = createMobileFileSystem()
  ensureMobileRawDataRuntime({
    pathService: runtime.pathService,
    fileSystem
  })
  const notebookManager = getMobileNotebookRawManager()
  if (!notebookManager) throw new Error('notebook manager unavailable')

  const repo = requireRepo()
  const { KnowledgeEmbeddingStorage } = await import('@baishou/ai')
  const { KnowledgeIngestService } = await import('@baishou/core-mobile')
  const storage = new KnowledgeEmbeddingStorage(() => repo)
  const vaultId = await resolveMobileActiveVaultId()

  const { NotebookGraphRawManager } = await import('@baishou/core-mobile')
  const graphRaw = new NotebookGraphRawManager(runtime.pathService, fileSystem)

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    getVaultId: () => vaultId,
    embedding:
      emb.embeddingProvider && emb.embeddingModelId
        ? {
            isConfigured: true,
            getModelId: () => emb.embeddingModelId!,
            getProviderInstance: async () => emb.embeddingProvider!
          }
        : undefined,
    insertChunk: async (params) => {
      await storage.insertEmbedding({
        id: params.chunkId,
        sourceType: 'knowledge',
        sourceId: params.sourceId,
        groupId: params.notebookId,
        vaultId: params.vaultId,
        chunkIndex: params.chunkIndex,
        chunkText: params.chunkText,
        metadataJson: params.metadataJson,
        embedding: params.embedding,
        modelId: params.modelId
      })
    },
    deleteChunksBySource: (id) => repo.deleteChunksBySource(id),
    deleteNotebookGraphSource: ({ notebookId, sourceId }) =>
      graphRaw.deleteSourceShards(notebookId, sourceId),
    getExtractConfig: (await import('./mobile-knowledge-extract-config'))
      .resolveMobileKnowledgeExtractConfig,
    onExtractProgress: (await import('./mobile-knowledge-extract-config'))
      .emitMobileKnowledgeExtractProgress
  })
}

export async function mobileGetNotebook(notebookId: string) {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  return requireRepo().getNotebook(id)
}

export async function mobileCreateNotebook(input: {
  name: string
  description?: string
  coverTone?: string
  coverIcon?: string
}) {
  const svc = await buildMobileIngestService()
  return svc.createNotebook(input)
}

export async function mobileReorderNotebooks(orderedIds: string[]) {
  const svc = await buildMobileIngestService()
  return svc.reorderNotebooks(orderedIds)
}

export async function mobileDeleteNotebook(notebookId: string): Promise<void> {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const svc = await buildMobileIngestService()
  await svc.deleteNotebook(id)
}

export async function mobileOrganizeNotebook(notebookId: string): Promise<{ queued: number }> {
  const id = notebookId.trim()
  if (!id) throw new Error('notebookId required')
  const svc = await buildMobileIngestService()
  const result = await svc.organizeNotebook(id)
  await kickMobileKnowledgeIngest('after-mobile-organize')
  return result
}

export async function mobileUpdateNotebook(input: {
  notebookId: string
  name?: string
  description?: string
  coverTone?: string | null
  coverIcon?: string | null
  coverImage?: string | null
}) {
  const svc = await buildMobileIngestService()
  return svc.updateNotebook(input)
}

export async function mobileSetCoverImage(input: { notebookId: string; absolutePath: string }) {
  const svc = await buildMobileIngestService()
  return svc.setCoverImage(input)
}

export async function mobileManageNotebookData(
  notebookId: string,
  input: { action: 'clear' | 'reprocess'; vector?: boolean; graph?: boolean }
) {
  const svc = await buildMobileIngestService()
  // 勾选向量+图谱时，core 以 followGraph: true 在 embed 成功后再抽图
  const result = await svc.manageNotebookData(notebookId, input)
  if (input.action === 'reprocess') {
    await kickMobileKnowledgeIngest('after-mobile-manage-data')
  }
  return result
}

export async function mobileResolveNotebookCoverUri(relativePath: string): Promise<string | null> {
  const rel = relativePath.trim()
  if (!rel) return null
  const manager = getMobileNotebookRawManager()
  if (!manager) return null
  try {
    const abs = await manager.absolutePath(rel)
    if (!abs) return null
    return abs.startsWith('file://')
      ? abs
      : abs.startsWith('/')
        ? `file://${abs}`
        : `file:///${abs}`
  } catch {
    return null
  }
}

/** 移动端粘贴文本 / URL / 文件入库 */
export async function mobileImportSource(input: {
  notebookId: string
  title: string
  kind: 'file' | 'text' | 'url'
  textContent?: string
  originUrl?: string
  absolutePath?: string
  fileName?: string
  importProcessMode?: KnowledgeImportProcessMode | string
  extractEngine?: 'ocr' | 'vision'
}): Promise<{ sourceId: string }> {
  const { fetchUrlAsMarkdown } = await import('@baishou/ai')
  let payload = { ...input }
  const importProcessMode = normalizeKnowledgeImportProcessMode(input.importProcessMode)

  if (input.kind === 'url') {
    const originUrl = (input.originUrl || input.textContent || '').trim()
    if (!originUrl) throw new Error('import url requires originUrl')
    const fetched = await fetchUrlAsMarkdown(originUrl, { allowPrivateNetwork: true })
    if (!fetched.markdown?.trim()) throw new Error('URL content empty or could not be parsed')
    payload = {
      ...input,
      kind: 'url',
      originUrl: fetched.finalUrl || originUrl,
      title: input.title?.trim() || fetched.title || originUrl,
      textContent: fetched.markdown
    }
  }

  if (input.kind === 'file') {
    if (!input.absolutePath?.trim()) throw new Error('import file requires absolutePath')
  }

  const svc = await buildMobileIngestService()
  const result = await svc.importSource({
    notebookId: payload.notebookId,
    title: payload.title,
    kind: payload.kind,
    textContent: payload.textContent,
    originUrl: payload.originUrl,
    absolutePath: payload.absolutePath,
    fileName: payload.fileName,
    importProcessMode,
    extractEngine: input.extractEngine
  })

  if (!shouldDeferKnowledgeImportOrganize(importProcessMode)) {
    await kickMobileKnowledgeIngest('after-mobile-import')
  }
  return result
}

/** 把相册 / DocumentPicker URI 落到本机绝对路径，再交给 copySourceFile */
export async function resolveMobileKnowledgeFilePath(
  uri: string,
  fileName: string
): Promise<string> {
  const { cacheDirectory } = await import('./mobile-sandbox-fs')
  const { importUriToPath } = await import('./mobile-uri-import')
  const fileSystem = createMobileFileSystem()
  // 去掉路径非法字符和控制字符，避免落到缓存名里
  // eslint-disable-next-line no-control-regex -- 文件名消毒需要匹配 ASCII 控制字符
  const safeName = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_') || 'import.bin'
  const destUri = `${String(cacheDirectory || '').replace(/\/$/, '')}/kb-import-${Date.now()}-${safeName}`
  const destPath = destUri.replace(/^file:\/\//, '')
  await importUriToPath(uri, destPath, fileSystem)
  return destPath
}

export {
  mobileSearchKnowledge,
  mobileListKnowledgeChunks,
  mobileSearchNotebookGraphNodes,
  mobileListNotebookGraphJobs,
  mobileGetNotebookGraphView,
  mobileSearchNotebookGraph
} from './mobile-knowledge-search.service'

export {
  mobileGetKnowledgeConfig,
  mobileSetKnowledgeConfig,
  subscribeMobileKnowledgeExtractProgress
} from './mobile-knowledge-extract-config'

export async function mobileGetKnowledgeCapabilities() {
  const { probeExtractEngineCapabilities } = await import('@baishou/core-mobile')
  const cfg = await (
    await import('./mobile-knowledge-extract-config')
  ).resolveMobileKnowledgeExtractConfig()
  return probeExtractEngineCapabilities({
    visionModelConfigured: cfg.visionModelConfigured,
    visionModelId: cfg.visionModelId,
    ocrLanguage: cfg.ocrLanguage
  })
}

export async function mobileCancelExtract(sourceId: string) {
  const id = sourceId.trim()
  if (!id) throw new Error('sourceId required')
  const svc = await buildMobileIngestService()
  const result = await svc.cancelExtract(id)
  const { emitMobileKnowledgeExtractProgress } = await import('./mobile-knowledge-extract-config')
  emitMobileKnowledgeExtractProgress({ sourceId: id, page: 0, total: 0, phase: 'ocr' })
  return result
}

export async function mobileRecoverStaleIngest() {
  const svc = await buildMobileIngestService()
  return svc.recoverStaleIngestState()
}

export async function mobileOcrMissingPages(
  sourceId: string,
  options?: { engine?: 'ocr' | 'vision'; pageNumbers?: number[] }
) {
  const id = sourceId.trim()
  if (!id) throw new Error('sourceId required')
  const svc = await buildMobileIngestService()
  const result = await svc.ocrMissingPages(id, options)
  await kickMobileKnowledgeIngest('after-ocr')
  return result
}

export async function mobileEmbedSource(sourceId: string) {
  const id = sourceId.trim()
  if (!id) throw new Error('sourceId required')
  const svc = await buildMobileIngestService()
  await svc.reprocessSource(id, 'embed')
  await kickMobileKnowledgeIngest('mobile-embed-source')
}

export async function mobileGetExtractedPreview(input: {
  notebookId: string
  sourceId: string
  maxChars?: number
}): Promise<{ text: string | null; truncated: boolean }> {
  const notebookId = input.notebookId.trim()
  const sourceId = input.sourceId.trim()
  if (!notebookId || !sourceId) throw new Error('notebookId and sourceId required')
  const manager = getMobileNotebookRawManager()
  if (!manager) return { text: null, truncated: false }
  const text = await manager.readExtractedText(notebookId, sourceId)
  if (text == null) return { text: null, truncated: false }
  const max = Math.max(200, input.maxChars ?? 4000)
  if (text.length <= max) return { text, truncated: false }
  return { text: text.slice(0, max), truncated: true }
}

export async function mobileProbeExtractSample(input: {
  notebookId?: string
  sourceId: string
  engine: 'ocr' | 'vision'
  ocrLanguage?: string
  ocrConcurrency?: number
}) {
  const sourceId = input.sourceId.trim()
  if (!sourceId) throw new Error('sourceId required')
  const repo = requireRepo()
  const source = await repo.getSource(sourceId)
  if (!source) throw new Error(`source not found: ${sourceId}`)
  const notebookId = String(input.notebookId || '').trim()
  if (notebookId && source.notebookId !== notebookId) {
    throw new Error('source not in notebook')
  }
  if (!source.relativePath) throw new Error('source file not found')
  const manager = getMobileNotebookRawManager()
  if (!manager) throw new Error('notebook manager unavailable')
  const abs = await manager.absolutePath(source.relativePath)
  const { probeKnowledgeExtractSample } = await import('@baishou/core-mobile')
  const { clampOcrConcurrency, normalizeKnowledgeDefaultExtractEngine } =
    await import('@baishou/shared')
  const cfg = await (await import('./mobile-knowledge-extract-config')).mobileGetKnowledgeConfig()
  const extractCfg = await (
    await import('./mobile-knowledge-extract-config')
  ).resolveMobileKnowledgeExtractConfig()
  return probeKnowledgeExtractSample({
    source,
    absolutePath: abs,
    engine: normalizeKnowledgeDefaultExtractEngine(input.engine),
    language: input.ocrLanguage ?? cfg.ocrLanguage,
    dpi: cfg.ocrDpi,
    concurrency: clampOcrConcurrency(input.ocrConcurrency ?? cfg.ocrConcurrency),
    visionProviderId: extractCfg.visionProviderId,
    visionModelId: extractCfg.visionModelId
  })
}
