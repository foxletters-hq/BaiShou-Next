import {
  GraphLlmExtractionService,
  GraphSyncService,
  bindPendingReextractCollaborators,
  createDefaultGraphExtractLlm,
  estimateExtractionCost,
  type GraphExtractAlignDeps,
  type GraphExtractDraft,
  type IFileSystem,
  type IStoragePathService,
  type SettingsManagerService
} from '@baishou/core-mobile'
import {
  GraphRepository,
  memoryEmbeddingsTable,
  type AppDatabase,
  type ShadowIndexRepository
} from '@baishou/database'
import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import {
  DIARY_EMBED_GROUP_ID,
  GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY,
  GRAPH_SELF_NAME_REQUIRED_ERROR,
  getUserProfileFromSettings,
  isDiaryEmbeddingPresent,
  normalizeGraphFilePath,
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  resolveGraphExtractSelfName,
  type GlobalModelsConfig,
  type ReasoningEffortSetting,
  type GraphExtractQueueProgressUpdate,
  type GraphExtractQueuePhase
} from '@baishou/shared'
import { and, eq } from 'drizzle-orm'
import i18n from 'i18next'
import {
  ensureMobileRawDataRuntime,
  resolveMobileEmbeddingForHydration
} from './mobile-raw-data-source.runtime'

let boundVault: string | null = null

export function ensureMobileGraphFreshnessBound(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
}) {
  const { freshness, graphManager } = ensureMobileRawDataRuntime(options)
  if (boundVault !== options.vaultName) {
    bindPendingReextractCollaborators({
      freshness,
      graphManager,
      shadowRepo: options.shadowRepo,
      getVaultName: () => options.vaultName,
      getVaultId: () => options.vaultId
    })
    boundVault = options.vaultName
  }
  return freshness
}

export function wireMobilePendingReextractHook(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  shadowSync: { setPendingReextractHook: (hook: any) => void }
}): void {
  const freshness = ensureMobileGraphFreshnessBound(options)
  options.shadowSync.setPendingReextractHook((filePath: string, contentHash: string) => {
    freshness.markPendingReextract(filePath, contentHash)
  })
}

async function resolveChatLlm(settingsManager: SettingsManagerService): Promise<{
  provider: IAIProvider
  modelId: string
  reasoningEffort?: ReasoningEffortSetting
} | null> {
  try {
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
    const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
    if (!providerId) return null
    const providers = (await settingsManager.get<Array<{ id: string }>>('ai_providers')) || []
    const cfg = providers.find((p) => p.id === providerId)
    if (!cfg) return null
    const provider = AIProviderRegistry.getInstance().getOrUpdateProvider(cfg as never)
    return {
      provider,
      modelId,
      reasoningEffort: resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
    }
  } catch {
    return null
  }
}

export async function mobileListPendingReextract(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
}) {
  const freshness = ensureMobileGraphFreshnessBound(options)
  return freshness.listPendingReextract()
}

export async function mobileExtractDiaries(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
  filePaths?: string[]
  signal?: AbortSignal
  onProgress?: (p: { current: number; total: number; filePath: string }) => void
}) {
  const service = await buildMobileExtractionService(options)
  return service.extractDiaries({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    selfName: await resolveMobileExtractSelfName(options.settingsManager),
    filePaths: options.filePaths,
    signal: options.signal,
    onProgress: options.onProgress
  })
}

export async function resolveMobileGraphExtractAlignDeps(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  settingsManager: SettingsManagerService
}): Promise<GraphExtractAlignDeps> {
  let embedQuery: GraphExtractAlignDeps['embedQuery']
  let modelId: string | undefined
  try {
    const { EmbeddingAdapter } = await import('@baishou/ai')
    const emb = await resolveMobileEmbeddingForHydration(options.settingsManager)
    if (emb.embeddingProvider && emb.embeddingModelId) {
      const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
      if (adapter.isConfigured) {
        embedQuery = (text) => adapter.embedQuery(text)
        modelId = adapter.embeddingModelId
      }
    }
  } catch {
    embedQuery = undefined
  }

  const embeddedSourceIds = new Set<string>()
  try {
    const rows = await options.drizzleDb
      .select({ sourceId: memoryEmbeddingsTable.sourceId })
      .from(memoryEmbeddingsTable)
      .where(
        and(
          eq(memoryEmbeddingsTable.sourceType, 'diary'),
          eq(memoryEmbeddingsTable.vaultId, options.vaultId),
          eq(memoryEmbeddingsTable.groupId, DIARY_EMBED_GROUP_ID)
        )
      )
    for (const row of rows) {
      if (row.sourceId) embeddedSourceIds.add(String(row.sourceId))
    }
  } catch {
    // table may be missing in tests
  }

  const diaryIdByPath = new Map<string, string>()
  try {
    const records = await options.shadowRepo.getAllRecords()
    for (const row of records) {
      diaryIdByPath.set(normalizeGraphFilePath(row.filePath), String(row.id))
    }
  } catch {
    // ignore
  }

  return {
    embedQuery,
    modelId,
    isEmbeddingConfigured: () => Boolean(embedQuery),
    isDiaryEmbedded: (filePath) => {
      const diaryId = diaryIdByPath.get(normalizeGraphFilePath(filePath))
      if (!diaryId) return false
      return isDiaryEmbeddingPresent(options.vaultId, diaryId, embeddedSourceIds)
    }
  }
}

export async function mobileExtractDraft(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
  filePath: string
  signal?: AbortSignal
  onProgress?: (update: GraphExtractQueueProgressUpdate) => void
}) {
  const service = await buildMobileExtractionService(options)
  return service.extractDraft({
    vaultId: options.vaultId,
    vaultName: options.vaultName,
    selfName: await resolveMobileExtractSelfName(options.settingsManager),
    filePath: options.filePath,
    signal: options.signal,
    onProgress: options.onProgress
  })
}

export async function mobileCommitGraphDrafts(
  options: {
    vaultId: string
    vaultName: string
    drizzleDb: AppDatabase
    shadowRepo: ShadowIndexRepository
    pathService: IStoragePathService
    fileSystem: IFileSystem
    settingsManager: SettingsManagerService
  },
  drafts: GraphExtractDraft[],
  signal?: AbortSignal,
  onPhase?: (phase: GraphExtractQueuePhase, detail?: string) => void
) {
  const service = await buildMobileExtractionService(options)
  return service.commitDrafts(drafts, signal, onPhase)
}

async function resolveMobileExtractSelfName(
  settingsManager: SettingsManagerService
): Promise<string> {
  const flag = await settingsManager.get<boolean>(GRAPH_SELF_NAME_CONFIGURED_SETTINGS_KEY)
  const profile = await getUserProfileFromSettings(settingsManager)
  const selfName = resolveGraphExtractSelfName(flag === true, profile?.nickname)
  if (!selfName) {
    throw new Error(GRAPH_SELF_NAME_REQUIRED_ERROR)
  }
  return selfName
}

async function buildMobileExtractionService(options: {
  vaultId: string
  vaultName: string
  drizzleDb: AppDatabase
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
}) {
  const freshness = ensureMobileGraphFreshnessBound(options)
  const { graphManager } = ensureMobileRawDataRuntime(options)
  const llmDeps = await resolveChatLlm(options.settingsManager)
  if (!llmDeps) {
    throw new Error(
      i18n.t(
        'auto.apps.mobile.src.services.mobile.graph.service.L93',
        '未配置对话模型，无法抽取图谱'
      )
    )
  }
  const repo = new GraphRepository(options.drizzleDb)
  let embedder: {
    embedQuery?: (text: string) => Promise<number[] | null>
    modelId?: string
  } | null = null
  try {
    const { EmbeddingAdapter } = await import('@baishou/ai')
    const emb = await resolveMobileEmbeddingForHydration(options.settingsManager)
    if (emb.embeddingProvider && emb.embeddingModelId) {
      const adapter = new EmbeddingAdapter(emb.embeddingProvider, emb.embeddingModelId)
      if (adapter.isConfigured) {
        embedder = {
          embedQuery: (text) => adapter.embedQuery(text),
          modelId: adapter.embeddingModelId
        }
      }
    }
  } catch {
    embedder = null
  }
  const graphSync = new GraphSyncService(graphManager, repo, embedder)
  const alignDeps = await resolveMobileGraphExtractAlignDeps(options)
  return new GraphLlmExtractionService(
    graphManager,
    freshness,
    repo,
    graphSync,
    options.pathService,
    options.fileSystem,
    createDefaultGraphExtractLlm(llmDeps),
    {
      embedQuery: alignDeps.embedQuery ?? embedder?.embedQuery,
      modelId: alignDeps.modelId ?? embedder?.modelId,
      isEmbeddingConfigured: alignDeps.isEmbeddingConfigured,
      isDiaryEmbedded: alignDeps.isDiaryEmbedded
    }
  )
}

export async function mobileEstimateExtraction(options: {
  vaultName: string
  vaultId: string
  shadowRepo: ShadowIndexRepository
  pathService: IStoragePathService
  fileSystem: IFileSystem
}) {
  const pending = await mobileListPendingReextract(options)
  const vault = await options.pathService.getActiveVaultPath()
  const charCounts: number[] = []
  if (vault) {
    for (const item of pending) {
      try {
        const full = `${vault.replace(/[/\\]+$/, '')}/${item.filePath.replace(/^[/\\]+/, '')}`
        const text = await options.fileSystem.readFile(full, 'utf8')
        charCounts.push(typeof text === 'string' ? text.length : 0)
      } catch {
        charCounts.push(0)
      }
    }
  }
  return estimateExtractionCost(pending.length, { charCounts })
}

export async function mobileResolveJournalForExtract(
  dateStr: string,
  shadowRepo: ShadowIndexRepository
): Promise<{ filePath: string; date: string } | null> {
  const date = String(dateStr || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const shadow = await shadowRepo.findByDate(date)
  const filePath = normalizeGraphFilePath(String(shadow?.filePath || ''))
  if (!filePath) return null
  return { filePath, date }
}
