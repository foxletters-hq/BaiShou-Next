import { buildVisionLanguageSlots, resolveProviderModelSlot } from '@baishou/shared'
import { getProviderIcon } from '@baishou/ui'
import type { AIProviderConfig } from '@baishou/shared'

export function resolveKnowledgeVisionDisplay(input: {
  providers: AIProviderConfig[]
  visionProviderId: string | null
  visionModelId: string | null
  isDark: boolean
}) {
  const visionHit = resolveProviderModelSlot(
    input.providers,
    buildVisionLanguageSlots({
      visionProviderId: input.visionProviderId,
      visionModelId: input.visionModelId
    })
  )
  const providerId = visionHit?.providerId || ''
  const modelId = visionHit?.modelId || ''
  const provider = input.providers.find((item) => item.id === providerId)
  const iconSrc =
    (providerId ? getProviderIcon(providerId, input.isDark) : undefined) ||
    (provider?.type ? getProviderIcon(provider.type, input.isDark) : undefined)
  return {
    isCustom: Boolean(input.visionProviderId && input.visionModelId),
    providerId,
    modelId,
    iconSrc
  }
}
