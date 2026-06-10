import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import {
  AIProviderConfig,
  ProviderType,
  isChatModelForConnectionTest,
  resolveProviderBaseUrl
} from '@baishou/shared'
import {
  BASE_KNOWN_PROVIDERS_CONFIG,
  PROVIDER_NAME_I18N_MAP,
  type KnownProviderMeta
} from '../../../constants/known-ai-providers'
import type { TFunction } from 'i18next'

export interface ProviderListItem {
  id: string
  name: string
  defaultBase: string
  isSystem: boolean
  sortOrder: number
  isEnabled: boolean
}

export function buildProviderListItems(
  savedProviders: AIProviderConfig[],
  t: TFunction
): ProviderListItem[] {
  const savedById = new Map(savedProviders.map((p) => [p.id, p]))

  const knownItems: ProviderListItem[] = BASE_KNOWN_PROVIDERS_CONFIG.map(
    (meta: KnownProviderMeta, index: number) => {
      const saved = savedById.get(meta.id)
      const name = PROVIDER_NAME_I18N_MAP[meta.id]
        ? t(PROVIDER_NAME_I18N_MAP[meta.id], meta.name)
        : meta.name
      return {
        id: meta.id,
        name: saved?.name || name,
        defaultBase: meta.defaultBase,
        isSystem: meta.isSystem ?? true,
        sortOrder: saved?.sortOrder ?? index,
        isEnabled: saved?.isEnabled ?? false
      }
    }
  )

  const knownIds = new Set(knownItems.map((p) => p.id))
  const customItems: ProviderListItem[] = savedProviders
    .filter((p) => !knownIds.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name || p.id,
      defaultBase: p.baseUrl || '',
      isSystem: p.isSystem ?? false,
      sortOrder: p.sortOrder ?? 999,
      isEnabled: p.isEnabled ?? false
    }))

  return [...knownItems, ...customItems].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function getProviderConfig(
  savedProviders: AIProviderConfig[],
  providerId: string,
  meta?: ProviderListItem
): AIProviderConfig {
  const existing = savedProviders.find((p) => p.id === providerId)
  if (existing) return existing

  const known = BASE_KNOWN_PROVIDERS_CONFIG.find((p) => p.id === providerId)
  const type = (known?.id ?? providerId) as ProviderType
  const defaultBase = meta?.defaultBase ?? known?.defaultBase ?? ''

  return {
    id: providerId,
    name: meta?.name ?? known?.name ?? providerId,
    type,
    apiKey: '',
    baseUrl: resolveProviderBaseUrl(providerId, type, defaultBase),
    models: [],
    enabledModels: [],
    defaultDialogueModel: '',
    defaultNamingModel: '',
    isEnabled: false,
    isSystem: meta?.isSystem ?? known?.isSystem ?? false,
    sortOrder: meta?.sortOrder ?? 999
  }
}

/** 按拖拽后的视觉顺序写入 sortOrder（与桌面 settings:reorder-providers 一致） */
export function applyProviderOrderFromIds(
  savedProviders: AIProviderConfig[],
  orderedIds: string[],
  itemsMeta?: ProviderListItem[]
): AIProviderConfig[] {
  const next = [...savedProviders]
  const metaById = new Map((itemsMeta ?? []).map((p) => [p.id, p]))

  const ensure = (id: string): AIProviderConfig => {
    const found = next.find((p) => p.id === id)
    if (found) return found
    const created = getProviderConfig(next, id, metaById.get(id))
    next.push(created)
    return created
  }

  orderedIds.forEach((id, index) => {
    ensure(id).sortOrder = index
  })

  return next
}

export function patchProviderInList(
  providers: AIProviderConfig[],
  providerId: string,
  updates: Partial<AIProviderConfig>,
  meta?: ProviderListItem
): AIProviderConfig[] {
  const index = providers.findIndex((p) => p.id === providerId)
  if (index >= 0) {
    const next = [...providers]
    next[index] = { ...next[index], ...updates }
    return next
  }
  return [...providers, { ...getProviderConfig(providers, providerId, meta), ...updates }]
}

export function effectiveProviderBaseUrl(
  providerId: string,
  type: ProviderType | string,
  baseUrl: string,
  defaultBase: string
): string {
  return resolveProviderBaseUrl(providerId, type, baseUrl || defaultBase)
}

function toRegistryConfig(config: AIProviderConfig, baseUrl: string): AIProviderConfig {
  return { ...config, baseUrl }
}

export async function fetchProviderModelsViaRegistry(
  config: AIProviderConfig,
  apiKey: string,
  baseUrl: string
): Promise<string[]> {
  const registry = AIProviderRegistry.getInstance()
  const instance = registry.getOrUpdateProvider(
    toRegistryConfig(config, baseUrl)
  ) as IAIProvider & {
    fetchAvailableModels?: () => Promise<string[]>
  }
  if (!instance.fetchAvailableModels) {
    throw new Error('Provider does not support fetchAvailableModels')
  }
  return instance.fetchAvailableModels()
}

export async function testProviderConnectionViaRegistry(
  config: AIProviderConfig,
  apiKey: string,
  baseUrl: string,
  testModelId: string
): Promise<void> {
  const registry = AIProviderRegistry.getInstance()
  const instance = registry.getOrUpdateProvider(
    toRegistryConfig({ ...config, apiKey }, baseUrl)
  ) as IAIProvider & {
    testConnection?: (modelId: string) => Promise<void>
  }
  if (!instance.testConnection) {
    throw new Error('Provider does not support testConnection')
  }
  await instance.testConnection(testModelId)
}

export function getChatModelsForTest(config: AIProviderConfig): string[] {
  const pool = config.enabledModels?.length ? config.enabledModels : config.models || []
  return pool.filter((m) => isChatModelForConnectionTest(m))
}
