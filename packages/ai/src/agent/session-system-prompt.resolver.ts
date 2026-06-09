import type { ISqlExecutor } from '@baishou/shared'
import {
  MessageRepository,
  SqliteHybridSearchRepository
} from '@baishou/database'
import type { IAIProvider } from '../providers/provider.interface'
import type { ToolRegistry } from '../tools/tool-registry'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'
import { EmbeddingAdapter } from '../tools/adapters/embedding.adapter'
import { MemoryDeduplicationServiceImpl } from '../rag/memory-deduplication.service'
import { SystemPromptBuilder } from './system-prompt.builder'

export interface AgentToolsContextParams {
  sessionId: string
  sessionRepo: {
    getSessionById?: (id: string) => Promise<{ vaultName?: string; assistantId?: string } | null>
    db?: unknown
    database?: unknown
  }
  assistantRepo?: {
    findById: (id: string) => Promise<{ systemPrompt?: string | null } | null>
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

function createClientExecutor(drizzleDb: any): ISqlExecutor {
  const rawClient = (drizzleDb?.session?.client || drizzleDb) as any
  if (typeof rawClient.execute === 'function') {
    return rawClient
  }

  return {
    execute: async (statement: string | { sql: string; args?: any[] }, args?: any[]) => {
      let sqlStr = ''
      let sqlArgs: any[] = []
      if (typeof statement === 'string') {
        sqlStr = statement
        sqlArgs = args || []
      } else {
        sqlStr = statement.sql
        sqlArgs = statement.args || []
      }

      if (typeof rawClient.prepare !== 'function') {
        throw new Error('Database client lacks both execute and prepare methods')
      }

      const stmt = rawClient.prepare(sqlStr)
      if (
        sqlStr.trim().toUpperCase().startsWith('SELECT') ||
        sqlStr.trim().toUpperCase().startsWith('PRAGMA')
      ) {
        const rows = stmt.all(...sqlArgs)
        return { rows }
      }
      const res = stmt.run(...sqlArgs)
      return { rows: [], ...res }
    }
  }
}

export async function resolveEnabledToolsForSession(
  params: AgentToolsContextParams
): Promise<Record<string, unknown>> {
  const drizzleDb = (params.sessionRepo as any).db || (params.sessionRepo as any).database
  if (!drizzleDb) {
    throw new Error('Agent database connection is unavailable')
  }

  const clientExecutor = createClientExecutor(drizzleDb)
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

  const sessionObj = await params.sessionRepo.getSessionById?.(params.sessionId)

  return params.toolRegistry.getEnabledToolsAsVercel({
    userConfig: params.userConfig,
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
  })
}

export async function buildSystemPromptForSession(
  params: AgentToolsContextParams
): Promise<string> {
  const enabledTools = await resolveEnabledToolsForSession(params)
  const sessionObj = await params.sessionRepo.getSessionById?.(params.sessionId)

  let effectiveSystemPrompt: string | undefined
  if (sessionObj?.assistantId && params.assistantRepo) {
    const ast = await params.assistantRepo.findById(sessionObj.assistantId)
    if (ast?.systemPrompt) {
      effectiveSystemPrompt = ast.systemPrompt
    }
  }

  return SystemPromptBuilder.build({
    vaultName: sessionObj?.vaultName || 'default',
    tools: enabledTools as any,
    customPersona: effectiveSystemPrompt,
    userProfileBlock:
      typeof params.userConfig?.userCard === 'string' ? params.userConfig.userCard : undefined
  })
}
