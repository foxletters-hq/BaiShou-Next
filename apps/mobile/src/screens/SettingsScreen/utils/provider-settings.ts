import { AIProviderRegistry, type IAIProvider } from '@baishou/ai'
import {
  AIProviderConfig,
  ProviderType,
  isChatModelForConnectionTest,
  resolveEnabledModelPool,
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

export interface ProviderListGroups {
  enabled: ProviderListItem[]
  disabled: ProviderListItem[]
}

let providerSettingsCache: AIProviderConfig[] | null = null
let providerListItemsCache: ProviderListItem[] | null = null

export function clearProviderSettingsCache(): void {
  providerSettingsCache = null
  providerListItemsCache = null
}

export function peekProviderSettingsCache(): AIProviderConfig[] | null {
  return providerSettingsCache
}

export function peekProviderListItemsCache(): ProviderListItem[] | null {
  return providerListItemsCache
}

export function writeProviderSettingsCache(
  list: AIProviderConfig[],
  options?: { keepListCache?: boolean }
): void {
  providerSettingsCache = list
  if (!options?.keepListCache) {
    providerListItemsCache = null
  }
}

export function writeProviderListItemsCache(items: ProviderListItem[]): void {
  providerListItemsCache = items
}

export function buildAndCacheProviderListItems(
  savedProviders: AIProviderConfig[],
  t: TFunction
): ProviderListItem[] {
  const items = buildProviderListItems(savedProviders, t)
  providerListItemsCache = items
  return items
}

/** 内置目录或已保存的自定义供应商均为有效详情页目标 */
export function isValidProviderId(providerId: string, savedProviders: AIProviderConfig[]): boolean {
  if (BASE_KNOWN_PROVIDERS_CONFIG.some((p) => p.id === providerId)) return true
  return savedProviders.some((p) => p.id === providerId)
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

  return [...knownItems, ...customItems].sort((a, b) => {
    if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1
    return a.sortOrder - b.sortOrder
  })
}

export function splitProviderListItems(items: ProviderListItem[]): ProviderListGroups {
  const enabled: ProviderListItem[] = []
  const disabled: ProviderListItem[] = []
  for (const item of items) {
    if (item.isEnabled) enabled.push(item)
    else disabled.push(item)
  }
  return { enabled, disabled }
}

export function mergeProviderListGroups(groups: ProviderListGroups): ProviderListItem[] {
  return [...groups.enabled, ...groups.disabled]
}

/** 扁平列表拖拽时限制在同一启用状态分组内（兼容旧版 ProviderSortableList / HMR 缓存） */
export function reorderProviderItemsWithinGroups(
  items: ProviderListItem[],
  from: number,
  to: number
): ProviderListItem[] {
  if (from === to || from < 0 || to < 0 || from >= items.length) return items

  const enabledCount = items.filter((i) => i.isEnabled).length
  const moving = items[from]
  if (!moving) return items

  let target = to
  if (moving.isEnabled) {
    target = Math.min(Math.max(0, target), Math.max(0, enabledCount - 1))
  } else {
    target = Math.min(Math.max(enabledCount, target), items.length - 1)
  }

  if (from === target) return items

  const next = [...items]
  const [removed] = next.splice(from, 1)
  if (!removed) return items
  next.splice(target, 0, removed)
  return next
}

export function reorderEnabledProviders(
  allItems: ProviderListItem[],
  enabledReordered: ProviderListItem[]
): ProviderListItem[] {
  const disabled = allItems.filter((item) => !item.isEnabled)
  return mergeProviderListGroups({ enabled: enabledReordered, disabled })
}

export function reorderDisabledProviders(
  allItems: ProviderListItem[],
  disabledReordered: ProviderListItem[]
): ProviderListItem[] {
  const enabled = allItems.filter((item) => item.isEnabled)
  return mergeProviderListGroups({ enabled, disabled: disabledReordered })
}

/** 启用供应商时排到已启用分组末尾 */
export function computeSortOrderOnEnable(items: ProviderListItem[]): number {
  const enabledOrders = items.filter((p) => p.isEnabled).map((p) => p.sortOrder)
  return enabledOrders.length > 0 ? Math.max(...enabledOrders) + 1 : 0
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
  const pool = resolveEnabledModelPool(config)
  return pool.filter((m) => isChatModelForConnectionTest(m))
}
