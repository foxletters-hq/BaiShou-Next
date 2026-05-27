import { EmbeddingService, IEmbeddingConfig, AIProviderRegistry } from '@baishou/ai'
import { settingsManager } from './settings.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { AIProviderConfig } from '@baishou/shared'
import { registerRagBuildIPC } from './rag-build.ipc'
import { registerRagQueryIPC } from './rag-query.ipc'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'

class DesktopEmbeddingConfig implements IEmbeddingConfig {
  private _cachedConfig: any = {}

  async load() {
    this._cachedConfig = (await settingsManager.get<any>('global_models')) || {}
  }

  getGlobalEmbeddingModelId(): string {
    return this._cachedConfig.globalEmbeddingModelId || ''
  }
  getGlobalEmbeddingProviderId(): string {
    return this._cachedConfig.globalEmbeddingProviderId || ''
  }
  getGlobalEmbeddingDimension(): number {
    return this._cachedConfig.globalEmbeddingDimension || 0
  }
  async setGlobalEmbeddingDimension(dimension: number): Promise<void> {
    const config = (await settingsManager.get<any>('global_models')) || {}
    config.globalEmbeddingDimension = dimension
    await settingsManager.set('global_models', config)
    this._cachedConfig = config
  }
  async restoreEmbeddingModelConfig(config: {
    globalEmbeddingProviderId: string
    globalEmbeddingModelId: string
    globalEmbeddingDimension: number
  }): Promise<void> {
    const current = (await settingsManager.get<any>('global_models')) || {}
    const next = {
      ...current,
      globalEmbeddingProviderId: config.globalEmbeddingProviderId,
      globalEmbeddingModelId: config.globalEmbeddingModelId,
      globalEmbeddingDimension: config.globalEmbeddingDimension
    }
    await settingsManager.set('global_models', next)
    this._cachedConfig = next
  }
  async getProviderInstance(): Promise<any> {
    const providerId = this.getGlobalEmbeddingProviderId()
    if (!providerId) return null

    const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
    const pConfig = providers.find((p) => p.id === providerId)
    if (!pConfig) return null

    return AIProviderRegistry.getInstance().getOrUpdateProvider(pConfig)
  }
}

export function filterUnindexedDiaries<T extends { id: any; updatedAt?: Date }>(
  diaries: T[],
  embeddedIds: Set<string>,
  embeddedUpdatedAtMap: Map<string, number>
): T[] {
  return diaries.filter((d) => {
    const sId = String(d.id)
    if (!embeddedIds.has(sId)) {
      return true
    }
    const existingUpdatedAt = embeddedUpdatedAtMap.get(sId)
    if (existingUpdatedAt !== undefined && d.updatedAt) {
      return d.updatedAt.getTime() > existingUpdatedAt
    }
    return false
  })
}

let config: DesktopEmbeddingConfig | null = null
let storage: DesktopEmbeddingStorage | null = null
let embeddingService: EmbeddingService | null = null

export function getEmbeddingConfig(): DesktopEmbeddingConfig {
  if (!config) {
    config = new DesktopEmbeddingConfig()
  }
  return config
}

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    const cfg = getEmbeddingConfig()
    if (!storage) {
      storage = new DesktopEmbeddingStorage()
    }
    embeddingService = new EmbeddingService(cfg, storage)
  }
  return embeddingService
}

export function registerRagIPC() {
  void getEmbeddingMigrationStateService().reconcile()
  registerRagBuildIPC()
  registerRagQueryIPC()
}
