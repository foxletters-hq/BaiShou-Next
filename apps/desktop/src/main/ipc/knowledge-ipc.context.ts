import { ipcMain, BrowserWindow } from 'electron'
import { toLocalProtocolFileUrl } from '../local-protocol.util'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import {
  KnowledgeIngestService,
  KnowledgeSearchService,
  NotebookGraphRawManager,
  type KnowledgeExtractProgress
} from '@baishou/core-desktop'
import { KnowledgeEmbeddingStorage } from '@baishou/ai'
import {
  buildVisionLanguageSlots,
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  isVisionModel,
  resolveProviderModelSlot,
  normalizeKnowledgeDefaultExtractEngine,
  normalizeKnowledgeImportProcessMode,
  type KnowledgeConfig,
  type AIProviderConfig
} from '@baishou/shared'
import { getNotebookRawManager } from '../services/raw-data-source.runtime'
import { createDesktopKnowledgeGraphExtractFn } from '../services/desktop-knowledge-graph-extract'
import { fileSystem } from '../services/node-file-system'
import { getEmbeddingService } from './rag.ipc'
import { settingsManager } from './settings.ipc'
import { pathService, resolveActiveVaultId } from './vault.ipc'
import { listNotebookCoverCandidateRels } from './knowledge-cover.util'

const DEFAULT_KNOWLEDGE_CONFIG: KnowledgeConfig = {
  defaultExtractEngine: 'ocr',
  importProcessMode: 'both',
  ocrLanguage: 'chi_sim+eng',
  ocrDpi: 250,
  ocrConcurrency: DEFAULT_OCR_CONCURRENCY,
  multiQueryAsk: false
}

export function requireKnowledgeRepo(): KnowledgeRepository {
  if (!knowledgeConnectionManager.isConnected()) {
    throw new Error('knowledge db not connected')
  }
  return new KnowledgeRepository(knowledgeConnectionManager.getDb())
}

export function toCoverImageUrl(absolutePath: string): string {
  return toLocalProtocolFileUrl(absolutePath)
}

export async function resolveCoverRelativePath(
  notebookId: string,
  recorded: string | null | undefined
): Promise<string> {
  const manager = getNotebookRawManager()
  const candidates = listNotebookCoverCandidateRels(notebookId, recorded)
  for (const rel of candidates) {
    try {
      const abs = await manager.absolutePath(rel)
      if (await fileSystem.exists(abs)) return rel
    } catch {
      /* 路径越界时换下一个候选 */
    }
  }
  return ''
}

export async function withCoverImageUrl<T extends { id?: string; coverImage?: string | null }>(
  row: T
): Promise<T & { coverImageUrl: string | null }> {
  const notebookId = typeof row.id === 'string' ? row.id : ''
  if (!notebookId) return { ...row, coverImageUrl: null }
  try {
    const rel = await resolveCoverRelativePath(notebookId, row.coverImage)
    if (!rel) return { ...row, coverImage: row.coverImage ?? '', coverImageUrl: null }
    const abs = await getNotebookRawManager().absolutePath(rel)
    return { ...row, coverImage: rel, coverImageUrl: toCoverImageUrl(abs) }
  } catch {
    return { ...row, coverImageUrl: null }
  }
}

export function requireActiveVaultId(): string {
  const id = resolveActiveVaultId()?.trim() || ''
  if (!id) throw new Error('active vault not ready')
  return id
}

export async function assertKnowledgeModelMatch(
  repo: KnowledgeRepository,
  notebookIds?: string[]
): Promise<void> {
  const embeddingService = getEmbeddingService()
  const { getEmbeddingConfig } = await import('./rag.ipc')
  const embeddingConfig = getEmbeddingConfig()
  await embeddingConfig.load()
  const modelId = embeddingConfig.getGlobalEmbeddingModelId()
  if (!modelId || !embeddingService.isConfigured) return
  const vaultId = requireActiveVaultId()
  const ids = (notebookIds ?? []).map((id) => id.trim()).filter(Boolean)
  const mismatch = await repo.countHeterogeneousEmbeddings(modelId, {
    vaultId,
    ...(ids.length > 0 ? { notebookIds: ids } : {})
  })
  if (mismatch > 0) {
    throw new Error('knowledge-model-mismatch')
  }
}

export async function loadKnowledgeConfig(): Promise<KnowledgeConfig> {
  const raw = (await settingsManager.get<KnowledgeConfig>('knowledge_config')) || {}
  const merged = { ...DEFAULT_KNOWLEDGE_CONFIG, ...raw }
  merged.importProcessMode = normalizeKnowledgeImportProcessMode(merged.importProcessMode)
  merged.defaultExtractEngine = normalizeKnowledgeDefaultExtractEngine(merged.defaultExtractEngine)
  return merged
}

export async function resolveVisionConfigured(): Promise<{
  configured: boolean
  modelId: string | null
  providerId: string | null
}> {
  const cfg = await loadKnowledgeConfig()
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []

  const hit = resolveProviderModelSlot(
    providers,
    buildVisionLanguageSlots({
      visionProviderId: cfg.visionProviderId,
      visionModelId: cfg.visionModelId
    })
  )
  if (!hit) return { configured: false, modelId: null, providerId: null }
  const ok = isVisionModel(hit.modelId, hit.provider.type || hit.provider.id)
  return { configured: ok, modelId: hit.modelId, providerId: hit.providerId }
}

export function broadcastKnowledgeOcrProgress(info: KnowledgeExtractProgress): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    try {
      win.webContents.send('knowledge:ocr-progress', info)
    } catch {
      /* ignore */
    }
  }
}

function buildIngestService(): KnowledgeIngestService {
  const repo = requireKnowledgeRepo()
  const notebookManager = getNotebookRawManager()
  const storage = new KnowledgeEmbeddingStorage(() => repo)

  return new KnowledgeIngestService({
    repo,
    notebookManager,
    fs: fileSystem,
    getVaultId: () => requireActiveVaultId(),
    onExtractProgress: broadcastKnowledgeOcrProgress,
    getExtractConfig: async () => {
      const cfg = await loadKnowledgeConfig()
      const vision = await resolveVisionConfigured()
      return {
        defaultEngine: cfg.defaultExtractEngine,
        ocrLanguage: cfg.ocrLanguage,
        ocrDpi: cfg.ocrDpi,
        ocrConcurrency: clampOcrConcurrency(cfg.ocrConcurrency),
        visionModelConfigured: vision.configured,
        visionModelId: vision.modelId
      }
    },
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
    deleteChunksBySource: (sourceId) => repo.deleteChunksBySource(sourceId),
    extractNotebookGraph: createDesktopKnowledgeGraphExtractFn(),
    deleteNotebookGraphSource: async ({ notebookId, sourceId }) => {
      const raw = new NotebookGraphRawManager(pathService, fileSystem)
      await raw.deleteSourceShards(notebookId, sourceId)
    }
  })
}

let ingestService: KnowledgeIngestService | null = null

export function getKnowledgeIngestService(): KnowledgeIngestService {
  if (!ingestService) {
    ingestService = buildIngestService()
  }
  return ingestService
}

export function resetKnowledgeIngestService(): void {
  ingestService = null
}

export function buildSearchService(): KnowledgeSearchService {
  const repo = requireKnowledgeRepo()
  const sqlite = knowledgeConnectionManager.getSqlite()
  return new KnowledgeSearchService({
    sql: {
      all: (sql, params = []) =>
        sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>
    },
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    }
  })
}

export function handleKnowledgeIpc(
  channel: string,
  listener: Parameters<typeof ipcMain.handle>[1]
): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}
