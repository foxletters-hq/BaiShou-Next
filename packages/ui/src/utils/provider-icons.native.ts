/**
 * 供应商品牌图标（RN）：与桌面端共用 LobeHub 本地 SVG 资源（Metro 编译为组件）
 */
import type { ComponentType } from 'react'
import type { SvgProps } from 'react-native-svg'
import {
  PROVIDER_ICON_IDS,
  PROVIDER_ICON_REGISTRY,
  type ProviderIconRegistryId
} from './provider-icon-registry.generated'

export type ProviderIconComponent = ComponentType<SvgProps>

export { PROVIDER_ICON_IDS }

export function getProviderIconComponent(
  providerId: string,
  isDark: boolean
): ProviderIconComponent | undefined {
  const pair = PROVIDER_ICON_REGISTRY[providerId as ProviderIconRegistryId]
  if (!pair) return undefined
  return (isDark ? pair.dark : pair.light) as ProviderIconComponent
}

export function hasProviderIcon(providerId: string): boolean {
  return providerId in PROVIDER_ICON_REGISTRY
}

/** 图标已随 JS 包编译，无需预加载 */
export function preloadAllProviderIcons(): void {}
