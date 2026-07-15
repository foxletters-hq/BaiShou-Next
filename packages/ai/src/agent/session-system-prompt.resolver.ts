import { isAutoInjectCurrentTimeEnabled } from '@baishou/shared'
import {
  MessageRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import type { IAIProvider } from '../providers/provider.interface'
import type { ToolContext } from '../tools/agent.tool'
import type { ToolRegistry } from '../tools/tool-registry'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'
import { EmbeddingAdapter } from '../tools/adapters/embedding.adapter'
import { MemoryDeduplicationServiceImpl } from '../rag/memory-deduplication.service'
import { SystemPromptBuilder } from './system-prompt.builder'
import { resolveSessionAssistantContext } from './session-assistant-context.util'

export interface AgentToolsContextParams {
  sessionId: string
  sessionRepo: {
    getSessionById?: (id: string) => Promise<{ vaultName?: string; assistantId?: string } | null>
    db?: unknown
    database?: unknown
  }
  assistantRepo?: {
    findById: (
      id: string
    ) => Promise<{ systemPrompt?: string | null; assistantKind?: string | null } | null>
  }
  userConfig: Record<string, unknown>
  provider: IAIProvider
  modelId: string
  systemModels?: {
    embeddingProvider?: IAIProvider
    embeddingModelId?: string
  }
  toolRegistry: ToolRegistry
  diarySearcher?: unknown
  webSearchResultFetcher?: unknown
  fetchSearchPage?: unknown
}

async function buildToolExecutionContext(
  params: AgentToolsContextParams,
  mergedUserConfig: Record<string, unknown>
): Promise<ToolContext> {
  const drizzleDb = (params.sessionRepo as any).db || (params.sessionRepo as any).database
  if (!drizzleDb) {
    throw new Error('Agent database connection is unavailable')
  }

  const sessionObj = await params.sessionRepo.getSessionById?.(params.sessionId)
  const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
  const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
  const msgRepo = new MessageRepository(drizzleDb)
  const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb)

  let embAdapter: any
  if (params.systemModels?.embeddingProvider && params.systemModels?.embeddingModelId) {
    embAdapter = new EmbeddingAdapter(
      params.systemModels.embeddingProvider,
      params.systemModels.embeddingModelId,
      hsRepo
    )
  } else if (params.provider && params.modelId && params.userConfig?.hasEmbeddingModel) {
    embAdapter = new EmbeddingAdapter(params.provider, params.modelId, hsRepo)
  }

  let dedupService: any
  if (
    embAdapter &&
    params.systemModels?.embeddingProvider &&
    params.systemModels?.embeddingModelId
  ) {
    dedupService = new MemoryDeduplicationServiceImpl(
      embAdapter,
      dbAdapter,
      params.systemModels.embeddingProvider,
      params.systemModels.embeddingModelId
    )
  }

  return {
    userConfig: mergedUserConfig,
    sessionId: params.sessionId,
    vaultName: sessionObj?.vaultName || 'default',
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    diarySearcher: params.diarySearcher as any,
    webSearchResultFetcher: params.webSearchResultFetcher as any,
    fetchSearchPage: params.fetchSearchPage as any
  }
}

export async function resolveEnabledToolsForSession(
  params: AgentToolsContextParams
): Promise<Record<string, unknown>> {
  const { mergedUserConfig } = await resolveSessionAssistantContext(params)
  const toolContext = await buildToolExecutionContext(params, mergedUserConfig)
  return params.toolRegistry.getEnabledToolsAsVercel(toolContext)
}

export async function buildSystemPromptForSession(
  params: AgentToolsContextParams
): Promise<string> {
  const enabledTools = await resolveEnabledToolsForSession(params)
  const sessionObj = await params.sessionRepo.getSessionById?.(params.sessionId)
  const { effectiveSystemPrompt, assistantKind, mergedUserConfig } =
    await resolveSessionAssistantContext(params)

  const customGuidelines =
    typeof params.userConfig?.agentGuidelines === 'string'
      ? params.userConfig.agentGuidelines.trim() || undefined
      : undefined

  const localeFromMerged =
    typeof mergedUserConfig['locale'] === 'string' ? (mergedUserConfig['locale'] as string) : undefined
  const localeFromParams =
    typeof params.userConfig?.locale === 'string' ? params.userConfig.locale : undefined

  return SystemPromptBuilder.build({
    vaultName: sessionObj?.vaultName || 'default',
    tools: enabledTools as any,
    customPersona: effectiveSystemPrompt,
    assistantKind,
    userProfileBlock:
      typeof params.userConfig?.userCard === 'string' ? params.userConfig.userCard : undefined,
    diaryAiWritingPrompt:
      typeof params.userConfig?.diaryAiWritingPrompt === 'string'
        ? params.userConfig.diaryAiWritingPrompt
        : undefined,
    injectCurrentTime: isAutoInjectCurrentTimeEnabled(
      Array.isArray(mergedUserConfig['disabledToolIds'])
        ? (mergedUserConfig['disabledToolIds'] as string[])
        : undefined
    ),
    customGuidelines,
    locale: localeFromMerged ?? localeFromParams
  })
}
