import { EmbeddingService, IEmbeddingConfig, AIProviderRegistry } from '@baishou/ai'
import { settingsManager } from './settings.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { registerRagBuildIPC } from './rag-build.ipc'
import { registerRagQueryIPC } from './rag-query.ipc'
import { getEmbeddingMigrationStateService } from '../services/embedding-migration-state.service'
import { getAutoFixedProviders } from './settings-models.ipc'
import {
  EmbeddingProviderConfigError,
  readStoredApiKey,
  resolveProviderConfig
} from '../services/ai-provider-config.util'
import { logger } from '@baishou/shared'

export { EmbeddingProviderConfigError }

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
    await this.load()
    const providerId = this.getGlobalEmbeddingProviderId()
    if (!providerId) return null

    const providers = await getAutoFixedProviders()
    const raw = providers.find((p) => p.id === providerId)
    const storedApiKey = raw ? readStoredApiKey(raw) : ''
    logger.info('[RAG] Resolving embedding provider for migration', {
      providerId,
      modelId: this.getGlobalEmbeddingModelId(),
      hasStoredApiKey: storedApiKey.length > 0
    })

    let normalized
    try {
      normalized = resolveProviderConfig(providers, providerId)
    } catch (e) {
      if (e instanceof EmbeddingProviderConfigError) {
        logger.warn('[RAG] Embedding provider config invalid', {
          providerId,
          code: e.code,
          message: e.message
        })
      }
      throw e
    }

    const registry = AIProviderRegistry.getInstance()
    registry.removeProvider(providerId)
    return registry.getOrUpdateProvider(normalized)
  }
}

export { sortDiariesByDateAsc, sortDiariesByDateDesc } from '@baishou/shared'

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
