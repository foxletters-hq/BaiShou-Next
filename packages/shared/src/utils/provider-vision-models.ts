import { ProviderType } from '../types/ai-provider.types'

/**
 * 手工视觉模型覆盖：models.dev 未收录或本地部署场景。
 * 正常运行时以 vision-models.snapshot.generated.ts 为主。
 */
export const PROVIDER_VISION_MODEL_IDS: Readonly<Record<string, readonly string[]>> = {
  [ProviderType.Ollama]: ['llava', 'moondream', 'minicpm-v', 'bakllava'],
  [ProviderType.LMStudio]: ['llava', 'moondream']
}

export function normalizeModelBaseId(modelId: string): string {
  if (!modelId) return ''
  const normalizedId = modelId.toLowerCase().startsWith('accounts/fireworks/models/')
    ? modelId.replace(/(\d)p(?=\d)/g, '$1.')
    : modelId

  const parts = normalizedId.split('/')
  let baseModelName = (parts[parts.length - 1] || '').toLowerCase()

  if (baseModelName.endsWith(':free')) {
    baseModelName = baseModelName.replace(':free', '')
  }
  if (baseModelName.endsWith('(free)')) {
    baseModelName = baseModelName.replace('(free)', '')
  }
  if (baseModelName.endsWith(':cloud')) {
    baseModelName = baseModelName.replace(':cloud', '')
  }
  return baseModelName
}

export function isProviderListedVisionModel(
  providerKey: string | undefined,
  modelId: string
): boolean {
  if (!providerKey || !modelId) return false
  const list = PROVIDER_VISION_MODEL_IDS[providerKey.toLowerCase()]
  if (!list?.length) return false
  const base = normalizeModelBaseId(modelId)
  return list.some((id) => base.includes(id.toLowerCase()) || id.toLowerCase() === base)
}
