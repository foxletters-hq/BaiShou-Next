import {
  MessageRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'
import { EmbeddingAdapter } from '../tools/adapters/embedding.adapter'
import { MemoryDeduplicationServiceImpl } from '../rag/memory-deduplication.service'
import { detectProcessCommandRuntime } from '../agent-workspace/workspace-host-process'
import { SystemPromptBuilder } from './system-prompt.builder'
import { COMPRESSION_MESSAGE_FETCH_LIMIT } from './compression.constants'
import { ContextCompressorService } from './context-compressor.service'
import { resolveSessionCompressionConfig, usableContextTokens } from './context-compression.utils'
import { replaceEpochBaselineAfterCompression } from '../session-runtime/context-epoch'
import { resolveEffectiveProviderType } from '../providers/opencodego/opencodego.model-protocol'
import type { MessageWithParts } from './message.adapter'
import type { StreamChatOptions } from './agent-session.types'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import type { AssistantKind } from '@baishou/shared'

export async function buildAgentSessionToolsAndPrompt(input: {
  options: StreamChatOptions
  sessionAgentGate?: IBaishouAgentGate
  workspaceOptions?: StreamChatOptions['workspace']
  mergedUserConfig: Record<string, unknown>
  effectiveSystemPrompt?: string
  assistantKind: AssistantKind
  injectMessageTime: boolean
  configRecentCount: number
  vaultId: string
  vaultName: string
  saveDiaryBeforeCompression: (messages: MessageWithParts[]) => Promise<void>
  interruptOnGateReject: boolean
}): Promise<{
  enabledTools: Record<string, unknown>
  builtSystemPrompt: string
}> {
  const {
    options,
    sessionAgentGate,
    workspaceOptions,
    mergedUserConfig,
    effectiveSystemPrompt,
    assistantKind,
    injectMessageTime,
    configRecentCount,
    vaultId,
    vaultName,
    saveDiaryBeforeCompression,
    interruptOnGateReject
  } = input
  const {
    sessionId,
    provider,
    modelId,
    toolRegistry,
    sessionRepo,
    snapshotRepo,
    systemModels,
    userConfig,
    webSearchResultFetcher,
    userMessageId,
    flushSessionToDisk,
    rawDataSourceManager,
    syncGraphPendingIndex,
    deleteGraphRecord,
    graphReader,
    graphNodeLookup,
    graphEdgeLookup,
    knowledgeReader,
    knowledgeGraphReader,
    diarySearcher,
    skillsWriter,
    skillsCatalog,
    extraVercelToolsFactory
  } = options

  const drizzleDb = (sessionRepo as any).db || (sessionRepo as any).database
  if (!drizzleDb) {
    throw new Error('Agent database connection is unavailable')
  }
  const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)

  const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
  const msgRepo = new MessageRepository(drizzleDb)

  const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb, () => vaultId)
  let embAdapter: any = undefined
  if (systemModels?.embeddingProvider && systemModels?.embeddingModelId) {
    embAdapter = new EmbeddingAdapter(
      systemModels.embeddingProvider,
      systemModels.embeddingModelId,
      hsRepo
    )
  } else if (provider && modelId && userConfig?.['hasEmbeddingModel']) {
    embAdapter = new EmbeddingAdapter(provider, modelId, hsRepo)
  }

  let dedupService: any = undefined
  if (embAdapter && provider && modelId) {
    dedupService = new MemoryDeduplicationServiceImpl(embAdapter, dbAdapter, provider, modelId)
  }

  const contextCompressionRunner = {
    run: async (phase: 'upstream' | 'downstream', opts?: { force?: boolean }) => {
      const config = await resolveSessionCompressionConfig(sessionId, sessionRepo)
      const merged = { ...config, force: opts?.force }
      const usableWindow = usableContextTokens(
        merged.modelContextWindow ?? 0,
        merged.reservedTokens
      )
      if (merged.threshold <= 0 && usableWindow <= 0 && !merged.force) {
        return 'Companion auto-compression is disabled (threshold 0). Enable it in Memory settings or use force=true.'
      }
      const messagesForLifecycle = (await sessionRepo.getMessagesBySession(
        sessionId,
        COMPRESSION_MESSAGE_FETCH_LIMIT
      )) as MessageWithParts[]
      await saveDiaryBeforeCompression(messagesForLifecycle)
      const ok = await ContextCompressorService.tryCompress(
        provider,
        modelId,
        sessionRepo,
        snapshotRepo,
        sessionId,
        merged,
        resolveEffectiveProviderType(provider.config?.type ?? '', modelId),
        {
          ...(userMessageId ? { triggerUserMessageId: userMessageId } : {}),
          wrapMessageTime: injectMessageTime,
          recentCount: configRecentCount,
          systemPrompt: effectiveSystemPrompt
        }
      )
      if (ok) {
        const allForPrune = (await sessionRepo.getMessagesBySession(
          sessionId,
          COMPRESSION_MESSAGE_FETCH_LIMIT
        )) as MessageWithParts[]
        await ContextCompressorService.runPrune(sessionRepo, sessionId, allForPrune, {
          flushSessionToDisk
        })
        replaceEpochBaselineAfterCompression(sessionId, '')
      }
      const phaseLabel =
        phase === 'upstream' ? 'upstream / before model request' : 'downstream / after reply saved'
      return ok
        ? `Context compression (${phaseLabel}) completed. Rolling summary updated.`
        : `No compression (${phaseLabel}): below threshold (use force=true) or not enough history.`
    }
  }

  const gateProfile = workspaceOptions?.sessionKind === 'workspace' ? 'workspace' : 'companion'

  const toolContext = {
    userConfig: mergedUserConfig,
    sessionId,
    vaultId,
    vaultName,
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    diarySearcher,
    webSearchResultFetcher: webSearchResultFetcher,
    fetchSearchPage: options.fetchSearchPage,
    contextCompressionRunner,
    agentGate: sessionAgentGate,
    gateProfile,
    rawDataSourceManager,
    syncGraphPendingIndex,
    deleteGraphRecord,
    graphReader,
    graphNodeLookup,
    graphEdgeLookup,
    knowledgeReader,
    knowledgeGraphReader,
    skillsWriter,
    workspace: workspaceOptions,
    interruptOnGateReject
  } as Parameters<typeof toolRegistry.getEnabledToolsAsVercel>[0]

  const enabledTools = toolRegistry.getEnabledToolsAsVercel(toolContext)
  if (extraVercelToolsFactory) {
    try {
      const extra = await extraVercelToolsFactory(toolContext)
      Object.assign(enabledTools, extra)
    } catch (error) {
      console.warn('[AgentSession] extra vercel tools failed', error)
    }
  }

  const builtSystemPrompt = SystemPromptBuilder.build({
    vaultName,
    tools: enabledTools as any,
    customPersona: effectiveSystemPrompt,
    assistantKind,
    userProfileBlock:
      typeof userConfig?.['userCard'] === 'string' ? userConfig['userCard'] : undefined,
    diaryAiWritingPrompt:
      typeof userConfig?.['diaryAiWritingPrompt'] === 'string'
        ? userConfig['diaryAiWritingPrompt']
        : undefined,
    injectCurrentTime: injectMessageTime,
    customGuidelines:
      typeof userConfig?.['agentGuidelines'] === 'string'
        ? userConfig['agentGuidelines'].trim() || undefined
        : undefined,
    locale:
      typeof mergedUserConfig?.['locale'] === 'string'
        ? (mergedUserConfig['locale'] as string)
        : typeof userConfig?.['locale'] === 'string'
          ? (userConfig['locale'] as string)
          : undefined,
    workspaceEnv:
      workspaceOptions?.sessionKind === 'workspace' && workspaceOptions.folderRoot
        ? (() => {
            const runtime = detectProcessCommandRuntime()
            return {
              folderRoot: workspaceOptions.folderRoot,
              platform: workspaceOptions.env?.platform ?? process.platform,
              commandRuntimeBinary: runtime.binary,
              commandRuntimeFamily: runtime.family,
              commandRuntimeLabel: runtime.label,
              isGitRepo: workspaceOptions.env?.isGitRepo,
              gitBranch: workspaceOptions.env?.gitBranch,
              gitChangesCount: workspaceOptions.env?.gitChangesCount,
              notebookIds: workspaceOptions.notebookIds
            }
          })()
        : undefined,
    knowledgeMount: {
      notebookIds: workspaceOptions?.notebookIds ?? []
    },
    skillsCatalog
  })

  return { enabledTools, builtSystemPrompt }
}
