import type { GlobalModelsConfig } from '../types/settings.types'

/** 图关系抽取始终跟随默认对话模型 */
export function resolveGlobalGraphModelIds(
  models: Partial<GlobalModelsConfig> | null | undefined
): { providerId: string | undefined; modelId: string } {
  const dialogueProvider = models?.globalDialogueProviderId?.trim()
  const dialogueModel = models?.globalDialogueModelId?.trim()
  return {
    providerId: dialogueProvider || undefined,
    modelId: dialogueModel && dialogueModel !== 'off' ? dialogueModel : 'deepseek-chat'
  }
}
