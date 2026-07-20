import type { GlobalModelsConfig } from '../types/settings.types'

/** 图关系抽取：优先全局图模型槽位，否则回退对话模型 */
export function resolveGlobalGraphModelIds(
  models: Partial<GlobalModelsConfig> | null | undefined
): { providerId: string | undefined; modelId: string } {
  const graphProvider = models?.globalGraphProviderId?.trim()
  const graphModel = models?.globalGraphModelId?.trim()
  if (graphProvider && graphModel && graphModel !== 'off') {
    return { providerId: graphProvider, modelId: graphModel }
  }
  const dialogueProvider = models?.globalDialogueProviderId?.trim()
  const dialogueModel = models?.globalDialogueModelId?.trim()
  return {
    providerId: dialogueProvider || undefined,
    modelId: dialogueModel && dialogueModel !== 'off' ? dialogueModel : 'deepseek-chat'
  }
}

/** 图槽未配置或仍与当前对话模型一致时，应随对话模型同步 */
export function shouldSyncGraphModelsWithDialogue(
  config: Pick<
    GlobalModelsConfig,
    | 'globalDialogueProviderId'
    | 'globalDialogueModelId'
    | 'globalGraphProviderId'
    | 'globalGraphModelId'
  >
): boolean {
  const graphProvider = config.globalGraphProviderId?.trim() ?? ''
  const graphModel = config.globalGraphModelId?.trim() ?? ''
  if (!graphProvider || !graphModel || graphModel === 'off') return true
  return (
    graphProvider === (config.globalDialogueProviderId?.trim() ?? '') &&
    graphModel === (config.globalDialogueModelId?.trim() ?? '')
  )
}
