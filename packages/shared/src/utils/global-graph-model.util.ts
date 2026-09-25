import type { GlobalModelsConfig } from '../types/settings.types'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from './agent-dialogue-model.util'

/** 只认图抽取槽位。没配时返回空，由调用方提示用户去配置，不改用对话模型。 */
export function resolveGlobalGraphModelIds(
  models: Partial<GlobalModelsConfig> | null | undefined
): { providerId: string | undefined; modelId: string } {
  const graphModel = models?.globalGraphModelId
  if (!isConfiguredDialogueModelId(graphModel)) {
    return { providerId: undefined, modelId: '' }
  }
  const graphProvider = models?.globalGraphProviderId?.trim()
  return {
    providerId: isConfiguredProviderId(graphProvider) ? graphProvider : undefined,
    modelId: graphModel!.trim()
  }
}
