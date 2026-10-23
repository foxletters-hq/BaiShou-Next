import { isConfiguredDialogueModelId, isConfiguredProviderId } from './agent-dialogue-model.util'

export type ProviderModelSlot = {
  providerId?: string | null
  modelId?: string | null
}

export type ProviderModelSlotHit<T extends { id: string }> = {
  provider: T
  providerId: string
  modelId: string
}

/**
 * 按顺序采用第一组「服务商和模型都已写上，且服务商还在列表里」的槽位。
 * 某一组只写了一边，或服务商 id 对不上，就停住，不再改用后面的槽位或别的服务商。
 */
export function resolveProviderModelSlot<T extends { id: string; isEnabled?: boolean }>(
  providers: T[],
  slots: ProviderModelSlot[]
): ProviderModelSlotHit<T> | null {
  for (const slot of slots) {
    const providerReady = isConfiguredProviderId(slot.providerId)
    const modelReady = isConfiguredDialogueModelId(slot.modelId)
    if (!providerReady && !modelReady) continue
    if (!providerReady || !modelReady) return null
    const providerId = slot.providerId!.trim()
    const modelId = slot.modelId!.trim()
    const provider = providers.find((row) => row.id === providerId && row.isEnabled !== false)
    if (!provider) return null
    return { provider, providerId, modelId }
  }
  return null
}

/** 视觉识别只认调用方覆盖和知识库视觉槽位。没配视觉模型时不改用对话或总结。 */
export function buildVisionLanguageSlots(input: {
  overrideProviderId?: string | null
  overrideModelId?: string | null
  visionProviderId?: string | null
  visionModelId?: string | null
}): ProviderModelSlot[] {
  const slots: ProviderModelSlot[] = []
  if (
    isConfiguredProviderId(input.overrideProviderId) &&
    isConfiguredDialogueModelId(input.overrideModelId)
  ) {
    slots.push({
      providerId: input.overrideProviderId,
      modelId: input.overrideModelId
    })
  }
  slots.push({ providerId: input.visionProviderId, modelId: input.visionModelId })
  return slots
}
