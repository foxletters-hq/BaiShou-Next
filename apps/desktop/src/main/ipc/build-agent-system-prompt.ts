import { buildSystemPromptForSession } from '@baishou/ai'
import {
  getAgentManagers,
  toolRegistry,
  createDiarySearcher,
  createWebSearchResultFetcher,
  createFetchSearchPage,
  buildStreamConfig
} from './agent-helpers'
import { AgentChatService } from './AgentChatService'
import { settingsManager } from './settings.ipc'

async function resolveSearchModeEnabled(explicit?: boolean): Promise<boolean> {
  if (explicit === true) return true
  if (explicit === false) return false
  return (await settingsManager.get<boolean>('search_mode_enabled')) === true
}

export async function buildAgentSystemPrompt(
  sessionId: string,
  searchMode?: boolean
): Promise<string> {
  const { realSessionRepo, realAssistantRepo } = getAgentManagers()
  const assistantContextWindow = await AgentChatService.getAssistantContextWindow(sessionId)
  const webSearchEnabled = await resolveSearchModeEnabled(searchMode)
  const { provider, systemModels, userConfig } = await buildStreamConfig(
    undefined,
    undefined,
    webSearchEnabled,
    assistantContextWindow
  )

  const session = await realSessionRepo.getSessionById(sessionId)
  const modelId = session?.modelId || 'deepseek-chat'

  return buildSystemPromptForSession({
    sessionId,
    sessionRepo: realSessionRepo,
    assistantRepo: realAssistantRepo,
    userConfig: userConfig as Record<string, unknown>,
    provider,
    modelId,
    systemModels: systemModels as any,
    toolRegistry,
    diarySearcher: createDiarySearcher(),
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage()
  })
}
