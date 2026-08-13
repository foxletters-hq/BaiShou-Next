/**
 * 供应商图标（桌面端）：本地打包的 LobeHub static-svg，见 pnpm sync:provider-icons
 * 对齐 OpenCode：模型行使用所属供应商 icon，不做 model→品牌推断。
 */
import {
  PROVIDER_ICON_IDS,
  PROVIDER_ICON_REGISTRY,
  type ProviderIconRegistryId
} from './provider-icon-registry.generated'

export { PROVIDER_ICON_IDS }

export function getProviderIcon(providerId: string, isDark: boolean): string | undefined {
  const pair = PROVIDER_ICON_REGISTRY[providerId as ProviderIconRegistryId]
  if (!pair) return undefined
  return isDark ? pair.dark : pair.light
}

export function getProviderIconIds(): string[] {
  return [...PROVIDER_ICON_IDS]
}

export function hasProviderIcon(providerId: string): boolean {
  return providerId in PROVIDER_ICON_REGISTRY
}
