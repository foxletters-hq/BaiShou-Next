import { app } from 'electron'
import { connectionManager, UserProfileRepository } from '@baishou/database-desktop'
import { AIProviderRegistry } from '@baishou/ai'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  buildDiaryWritingGuidelinesForSystemPrompt,
  logger,
  formatUserCardFromProfile,
  isConfiguredProviderId,
  isConfiguredDialogueModelId,
  normalizeToolManagementConfig,
  normalizeEmojiToolConfig,
  resolveAssistantEmojiConfig,
  resolveAppUiLanguageFromSystemLocale,
  type AssistantEmojiPrefs,
  DEFAULT_TOOL_MANAGEMENT_CONFIG,
  resolveWebSearchEnabled,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  type BaishouAgentGateConfig,
  requireResolvedDialogueModel,
  resolveReasoningEffortForSlot,
  type ResolvedDialogueModel
} from '@baishou/shared'
import { settingsManager } from './settings.ipc'
import { getAgentManagers } from './agent-managers'
import { webSearchConfigToUserConfig } from '@baishou/ai'

export async function getActiveProvider(requestedProviderId?: string) {
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

  const providerId = requestedProviderId || globalModels?.globalDialogueProviderId
  const config = providers.find((p: AIProviderConfig) => p.id === providerId)

  const actualConfig = config || providers.find((p: AIProviderConfig) => p.isEnabled)
  if (!actualConfig) throw new Error('No active provider configured')

  const registry = AIProviderRegistry.getInstance()
  const provider = registry.getOrUpdateProvider(actualConfig)
  if (!provider) throw new Error(`Failed to instantiate provider ${actualConfig.id}`)
  return provider
}

type ResolvedProvider = Awaited<ReturnType<typeof getActiveProvider>>

export async function resolveEmbeddingSystemModels(
  globalModels?: GlobalModelsConfig | null
): Promise<{
  hasEmbeddingModel: boolean
  embeddingProvider?: ResolvedProvider
  embeddingModelId?: string
}> {
  const models = globalModels ?? (await settingsManager.get<GlobalModelsConfig>('global_models'))
  const embeddingProviderId = models?.globalEmbeddingProviderId
  let embeddingModelId = models?.globalEmbeddingModelId
  let embeddingProvider: ResolvedProvider | undefined

  if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
    try {
      embeddingProvider = await getActiveProvider(embeddingProviderId)
    } catch {
      embeddingModelId = undefined
    }
  } else {
    embeddingModelId = undefined
  }

  return {
    hasEmbeddingModel: Boolean(embeddingProvider && embeddingModelId),
    embeddingProvider,
    embeddingModelId
  }
}

/** 从设置构建 Agent/MCP 工具上下文用的 userConfig，不依赖对话模型 Provider */
export async function buildAgentUserConfigFromSettings(options?: {
  assistantContextWindow?: number
  searchMode?: boolean
  globalModels?: GlobalModelsConfig | null
  hasEmbeddingModel?: boolean
  emojiGroupId?: string | null
  assistantEmojiPrefs?: AssistantEmojiPrefs
}): Promise<Record<string, unknown>> {
  const ragConfig = await settingsManager.get<any>('rag_config')
  const toolManagementConfig = normalizeToolManagementConfig(
    (await settingsManager.get<any>('tool_management_config')) ?? DEFAULT_TOOL_MANAGEMENT_CONFIG
  )
  const behaviorConfig =
    (await settingsManager.get<any>('agent_behavior')) ??
    (await settingsManager.get<any>('agent_behavior_config'))
  const webSearchConfig = await settingsManager.get<any>('web_search_config')
  const diaryTemplateConfig = (await settingsManager.get<any>('diary_template_config')) || {}

  const hasEmbeddingModel =
    options?.hasEmbeddingModel ??
    (await resolveEmbeddingSystemModels(options?.globalModels)).hasEmbeddingModel

  let userCard: string | undefined
  try {
    const db = connectionManager.getDb()
    const profileRepo = new UserProfileRepository(db)
    const profile = await profileRepo.getProfile()
    userCard = formatUserCardFromProfile(profile)
  } catch (e: any) {
    logger.warn('[buildAgentUserConfigFromSettings] Failed to load user profile:', e.message || e)
  }

  const storedSearchMode = await settingsManager.get<boolean>('search_mode_enabled')
  const appSettings = (await settingsManager.get<{ language?: string }>('settings')) || {}
  const featureSettings =
    (await settingsManager.get<{ language?: string }>('feature_settings')) || {}
  const rawLanguage = featureSettings.language || appSettings.language
  const locale =
    !rawLanguage || rawLanguage === 'system'
      ? resolveAppUiLanguageFromSystemLocale(app.getLocale())
      : rawLanguage

  const agentGateStored =
    (await settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
    DEFAULT_BAISHOU_AGENT_GATE_CONFIG
  const baishou_agent_gate_config: BaishouAgentGateConfig = {
    ...agentGateStored,
    exclusionList: [...(agentGateStored.exclusionList ?? [])],
    allowlist: [...(agentGateStored.allowlist ?? [])]
  }

  const globalModelsForEffort =
    options?.globalModels ?? (await settingsManager.get<GlobalModelsConfig>('global_models'))
  const dialogueEffort = resolveReasoningEffortForSlot(
    globalModelsForEffort?.reasoningEffortBySlot,
    'dialogue'
  )

  return {
    ragEnabled: ragConfig?.ragEnabled ?? true,
    hasEmbeddingModel,
    disabledToolIds: toolManagementConfig.disabledToolIds,
    customConfigs: toolManagementConfig.customConfigs,
    recentCount:
      options?.assistantContextWindow !== undefined
        ? options.assistantContextWindow < 0
          ? 0
          : options.assistantContextWindow
        : (behaviorConfig?.agentContextWindowSize ?? 30),
    web_search_enabled: resolveWebSearchEnabled(options?.searchMode, storedSearchMode),
    ...webSearchConfigToUserConfig(webSearchConfig),
    userCard,
    diaryAiWritingPrompt: buildDiaryWritingGuidelinesForSystemPrompt(diaryTemplateConfig),
    agentGuidelines:
      typeof behaviorConfig?.agentGuidelines === 'string' &&
      behaviorConfig.agentGuidelines.trim().length > 0
        ? behaviorConfig.agentGuidelines.trim()
        : undefined,
    emojiConfig: resolveAssistantEmojiConfig(
      normalizeEmojiToolConfig(toolManagementConfig.emojiConfig),
      options?.assistantEmojiPrefs ?? { emojiGroupId: options?.emojiGroupId }
    ),
    locale,
    baishou_agent_gate_config,
    reasoningEffort: dialogueEffort,
    reasoningEffortDefault: dialogueEffort
  }
}

/** 流式对话权威模型链：请求 → 全局 → 错误（不伪造默认模型；伙伴不再绑定模型） */
export async function resolveStreamDialogueSelection(params: {
  sessionId?: string
  requestedProviderId?: string
  requestedModelId?: string
}): Promise<ResolvedDialogueModel & { providerId: string; modelId: string }> {
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  let assistantProviderId: string | undefined
  let assistantModelId: string | undefined

  if (params.sessionId) {
    try {
      const { realSessionRepo, realAssistantRepo } = getAgentManagers()
      const session = await realSessionRepo.getSessionById(params.sessionId)
      if (session?.assistantId) {
        const assistant = await realAssistantRepo.findById(session.assistantId)
        assistantProviderId = assistant?.providerId ?? undefined
        assistantModelId = assistant?.modelId ?? undefined
      }
    } catch (e: any) {
      logger.warn('[resolveStreamDialogueSelection] failed to load assistant:', e?.message || e)
    }
  }

  return requireResolvedDialogueModel({
    assistantProviderId,
    assistantModelId,
    requestedProviderId: params.requestedProviderId,
    requestedModelId: params.requestedModelId,
    globalDialogueProviderId: globalModels?.globalDialogueProviderId,
    globalDialogueModelId: globalModels?.globalDialogueModelId
  })
}

/**
 * 构建 Agent 流式调用所需的通用配置
 * @param assistantContextWindow 助手的上下文轮数配置，优先于全局配置
 */
export async function buildStreamConfig(
  requestedProviderId?: string,
  requestedModelId?: string,
  searchMode?: boolean,
  assistantContextWindow?: number,
  assistantEmojiPrefs?: AssistantEmojiPrefs
) {
  const provider = await getActiveProvider(requestedProviderId)
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

  const namingProviderId = globalModels?.globalNamingProviderId || provider.config.id
  let namingModelId =
    globalModels?.globalNamingModelId ||
    requestedModelId ||
    globalModels?.globalDialogueModelId ||
    'deepseek-chat'
  let namingProvider = provider
  if (namingProviderId !== provider.config.id) {
    try {
      namingProvider = await getActiveProvider(namingProviderId)
    } catch (e) {
      namingModelId = requestedModelId || globalModels?.globalDialogueModelId || 'deepseek-chat'
    }
  }

  const summaryProviderId = globalModels?.globalSummaryProviderId || provider.config.id
  let summaryModelId =
    globalModels?.globalSummaryModelId ||
    requestedModelId ||
    globalModels?.globalDialogueModelId ||
    'deepseek-chat'
  let summaryProvider = provider
  if (summaryProviderId !== provider.config.id) {
    try {
      summaryProvider = await getActiveProvider(summaryProviderId)
    } catch (e) {
      summaryModelId = requestedModelId || globalModels?.globalDialogueModelId || 'deepseek-chat'
    }
  }

  const { hasEmbeddingModel, embeddingProvider, embeddingModelId } =
    await resolveEmbeddingSystemModels(globalModels)

  const userConfig = await buildAgentUserConfigFromSettings({
    assistantContextWindow,
    searchMode,
    globalModels,
    hasEmbeddingModel,
    assistantEmojiPrefs
  })

  const namingModelConfigured =
    isConfiguredProviderId(globalModels?.globalNamingProviderId) &&
    isConfiguredDialogueModelId(globalModels?.globalNamingModelId)

  return {
    provider,
    globalModels,
    systemModels: {
      namingProvider,
      namingModelId,
      namingModelConfigured,
      namingReasoningEffort: resolveReasoningEffortForSlot(
        globalModels?.reasoningEffortBySlot,
        'naming'
      ),
      summaryProvider,
      summaryModelId,
      embeddingProvider,
      embeddingModelId
    },
    userConfig
  }
}
