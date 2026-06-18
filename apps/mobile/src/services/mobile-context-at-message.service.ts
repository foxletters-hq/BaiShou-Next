import {
  ContextAtMessageService,
  buildSystemPromptForSession,
  type ContextAtMessageResult,
  AIProviderRegistry,
  ToolRegistry,
  webSearchConfigToUserConfig
} from '@baishou/ai'
import {
  buildDiaryWritingGuidelinesForSystemPrompt,
  formatUserCardFromProfile,
  getUserProfileFromSettings,
  type DiaryTemplateConfig
} from '@baishou/shared'
import {
  DEFAULT_WEB_SEARCH_CONFIG,
  type SessionRepository,
  type SnapshotRepository
} from '@baishou/database'
import type { AssistantManagerService, SettingsManagerService } from '@baishou/core-mobile'
export interface MappedCallChainFlatEntry {
  kind: 'system-prompt' | 'compression-summary' | 'round-header' | 'message'
  roundIndex?: number
  summaryText?: string
  reasoningText?: string
  item?: {
    id: string
    role: 'system' | 'user' | 'assistant' | 'tool'
    content?: string
    label?: string
  }
}

export interface MobileContextAtMessageDeps {
  sessionRepo: SessionRepository
  snapshotRepo: SnapshotRepository
  assistantManager: AssistantManagerService
  settingsManager: SettingsManagerService
  toolRegistry: ToolRegistry
  diarySearcher?: unknown
  webSearchResultFetcher?: (url: string) => Promise<string>
  fetchSearchPage?: (url: string) => Promise<string>
}

export interface MobileContextAtMessagePayload {
  result: ContextAtMessageResult
  flatEntries: MappedCallChainFlatEntry[]
}

export async function resolveAssistantContextWindow(
  sessionId: string,
  sessionRepo: SessionRepository,
  assistantManager: AssistantManagerService
): Promise<number | undefined> {
  try {
    const session = await sessionRepo.getSessionById(sessionId)
    if (session?.assistantId) {
      const assistant = await assistantManager.findById(session.assistantId)
      if (assistant?.contextWindow !== undefined) {
        return assistant.contextWindow
      }
    }
  } catch {
    // ignore
  }
  return undefined
}

export async function buildMobileStreamUserConfig(
  settingsManager: SettingsManagerService,
  searchMode: boolean,
  assistantContextWindow?: number
): Promise<Record<string, unknown>> {
  const ragConfig = await settingsManager.get<any>('rag_config')
  const toolManagementConfig = await settingsManager.get<any>('tool_management_config')
  const behaviorConfig = await settingsManager.get<any>('agent_behavior_config')
  const webSearchConfig = await settingsManager.get<any>('web_search_config')
  const globalModels = await settingsManager.get<any>('global_models')
  const diaryTemplateConfig =
    (await settingsManager.get<DiaryTemplateConfig>('diary_template_config')) || {}
  const userProfile = await getUserProfileFromSettings(settingsManager)
  const providers = (await settingsManager.get<any[]>('ai_providers')) || []

  const embeddingProviderId = globalModels?.globalEmbeddingProviderId
  const embeddingModelId = globalModels?.globalEmbeddingModelId
  const hasEmbeddingModel =
    Boolean(embeddingProviderId) &&
    Boolean(embeddingModelId) &&
    embeddingModelId !== 'off' &&
    providers.some((p) => p.id === embeddingProviderId)

  return {
    ragEnabled: ragConfig?.ragEnabled ?? true,
    hasEmbeddingModel,
    disabledToolIds: toolManagementConfig?.disabledToolIds || [],
    recentCount:
      assistantContextWindow !== undefined
        ? assistantContextWindow < 0
          ? 0
          : assistantContextWindow
        : (behaviorConfig?.agentContextWindowSize ?? 30),
    web_search_enabled: searchMode,
    ...webSearchConfigToUserConfig({
      ...DEFAULT_WEB_SEARCH_CONFIG,
      ...(webSearchConfig || {})
    }),
    diaryAiWritingPrompt: buildDiaryWritingGuidelinesForSystemPrompt(diaryTemplateConfig),
    userCard: formatUserCardFromProfile(userProfile)
  }
}

export function mapContextResultToFlatEntries(
  result: ContextAtMessageResult,
  sessionId: string,
  sourceMessageId: string
): MappedCallChainFlatEntry[] {
  const vm = result.viewModel
  return (vm?.flatEntries ?? []).map((entry, i) => {
    if (entry.kind === 'round-header') {
      return { kind: 'round-header' as const, roundIndex: entry.roundIndex }
    }
    if (entry.kind === 'compression-summary') {
      return {
        kind: 'compression-summary' as const,
        summaryText: entry.summaryText ?? result.compressedContent ?? '',
        reasoningText: entry.reasoningText ?? vm?.compressionReasoning ?? ''
      }
    }
    if (entry.kind === 'system-prompt') {
      return {
        kind: 'system-prompt' as const,
        item: {
          id: `ctx-sys-${sourceMessageId}`,
          role: 'system',
          content: entry.item?.content ?? result.systemPrompt,
          label: '系统提示词'
        }
      }
    }
    return {
      kind: 'message' as const,
      roundIndex: entry.roundIndex,
      item: {
        id: `ctx-${sourceMessageId}-${i}`,
        role: entry.item?.role ?? 'user',
        content: entry.item?.content,
        label: entry.item?.label
      }
    }
  })
}

export async function loadContextAtMessage(
  deps: MobileContextAtMessageDeps,
  sessionId: string,
  messageId: string,
  searchMode = false
): Promise<MobileContextAtMessagePayload> {
  const assistantContextWindow = await resolveAssistantContextWindow(
    sessionId,
    deps.sessionRepo,
    deps.assistantManager
  )
  const userConfig = await buildMobileStreamUserConfig(
    deps.settingsManager,
    searchMode,
    assistantContextWindow
  )

  const session = await deps.sessionRepo.getSessionById(sessionId)
  const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
  const globalModels = await deps.settingsManager.get<any>('global_models')
  const providerId = session?.providerId || globalModels?.globalDialogueProviderId
  const providerConfig =
    providers.find((p) => p.id === providerId) || providers.find((p) => p.isEnabled)
  const registry = AIProviderRegistry.getInstance()
  const provider = providerConfig ? registry.getOrUpdateProvider(providerConfig) : undefined
  const modelId =
    session?.modelId ||
    globalModels?.globalDialogueModelId ||
    providerConfig?.defaultDialogueModel ||
    providerConfig?.models?.[0] ||
    'deepseek-chat'

  const systemPrompt = provider
    ? await buildSystemPromptForSession({
        sessionId,
        sessionRepo: deps.sessionRepo,
        assistantRepo: { findById: (id) => deps.assistantManager.findById(id) },
        userConfig,
        provider,
        modelId,
        toolRegistry: deps.toolRegistry,
        diarySearcher: deps.diarySearcher,
        webSearchResultFetcher: deps.webSearchResultFetcher,
        fetchSearchPage: deps.fetchSearchPage
      })
    : ''

  const recentCount =
    typeof userConfig.recentCount === 'number' ? (userConfig.recentCount as number) : 30

  const result = await ContextAtMessageService.getContextAtMessage(
    sessionId,
    messageId,
    deps.sessionRepo,
    deps.snapshotRepo,
    {
      recentCount,
      modelId,
      providerType: provider?.config?.type,
      systemPrompt
    }
  )

  const flatEntries = mapContextResultToFlatEntries(result, sessionId, messageId)

  return { result, flatEntries }
}
