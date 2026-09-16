import type { GlobalModelsConfig } from '../types/settings.types'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from './agent-dialogue-model.util'

/** 图关系抽取优先用独立槽位；未单独配置时回退到默认对话模型。 */
export function resolveGlobalGraphModelIds(
  models: Partial<GlobalModelsConfig> | null | undefined
): { providerId: string | undefined; modelId: string } {
  const graphModel = models?.globalGraphModelId
  if (isConfiguredDialogueModelId(graphModel)) {
    const graphProvider = models?.globalGraphProviderId?.trim()
    return {
      providerId: isConfiguredProviderId(graphProvider) ? graphProvider : undefined,
      modelId: graphModel!.trim()
    }
  }

  const dialogueModel = models?.globalDialogueModelId
  if (isConfiguredDialogueModelId(dialogueModel)) {
    const dialogueProvider = models?.globalDialogueProviderId?.trim()
    return {
      providerId: isConfiguredProviderId(dialogueProvider) ? dialogueProvider : undefined,
      modelId: dialogueModel!.trim()
    }
  }

  return { providerId: undefined, modelId: '' }
}
