import { stepCountIs, streamText } from 'ai'
import {
  AIProviderRegistry,
  KnowledgeGraphSearchTool,
  KnowledgeSearchTool,
  UrlReadTool,
  WebSearchTool,
  applyNotebookAgentStreamPart,
  buildReasoningProviderOptions,
  citationsFromKnowledgeHits,
  formatKnowledgeSearchHits,
  type ToolContext
} from '@baishou/ai'
import {
  canUseProviderModel,
  logger,
  normalizeReasoningEffortSetting,
  prepareProviderConfigForRuntime,
  resolveSummaryConfigFromSettings,
  resolveWebSearchEnabled,
  shouldRetrieveNotebookSources,
  webSearchConfigToUserConfig,
  type AIProviderConfig,
  type GlobalModelsConfig,
  type NotebookAskProgress,
  type NotebookAskToolState,
  type NotebookChatCitation,
  type WebSearchConfig
} from '@baishou/shared'
import { createFetchSearchPage, createWebSearchResultFetcher } from '../ipc/agent-helpers'
import { settingsManager } from '../ipc/settings.ipc'
import { resolveActiveVaultId } from '../ipc/vault.ipc'
import { createDesktopKnowledgeGraphReader } from './desktop-knowledge-graph-reader'
import { createDesktopKnowledgeReader } from './desktop-knowledge-reader'
import {
  buildNotebookWebSearchSystem,
  resolveNotebookWebSearchToolIds
} from './notebook-chat-web-search.util'

const NOTEBOOK_AGENT_SYSTEM = `你正在一本知识库笔记本里对话。
系统若已提供本轮检索资料，优先根据这些资料回答，并用 [1]、[2] 对应资料编号。
资料不足、用户换了主题、或需要人物/机构关系时，再调用工具：
- 查原文、定义、摘录：knowledge_search
- 查人物、主题、机构关系：knowledge_graph_search
当前笔记本已经绑定，不要传 notebookId；即使传了也会被忽略。
闲聊、打招呼、澄清问题不要调用工具。
没有资料时不要编造，也不要假装引用了来源。`

const TOOL_LABELS: Record<string, string> = {
  knowledge_search: '检索资料',
  knowledge_graph_search: '检索关系',
  web_search: '网络搜索',
  url_read: '阅读网页'
}

export async function runNotebookChatAgent(input: {
  notebookId: string
  question: string
  history: Array<{ role: 'user' | 'assistant'; text: string }>
  modelId?: string
  providerId?: string
  partnerName?: string
  systemPrompt?: string
  reasoningEffort?: string
  searchMode?: boolean
  abortSignal?: AbortSignal
  onProgress?: (event: Omit<NotebookAskProgress, 'notebookId'>) => void
}): Promise<{
  answer: string
  reasoning?: string
  citations: NotebookChatCitation[]
}> {
  const notebookId = input.notebookId.trim()
  if (!notebookId) throw new Error('notebookId required')
  const question = input.question.trim()
  if (!question) throw new Error('question required')

  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const modelId =
    input.modelId?.trim() ||
    globalModels?.globalDialogueModelId ||
    globalModels?.globalSummaryModelId
  if (!modelId) throw new Error('dialogue-not-configured')

  let providerConfig: AIProviderConfig | undefined
  if (input.providerId?.trim()) {
    providerConfig = canUseProviderModel(providers, input.providerId, modelId)
      ? providers.find((row) => row.id === input.providerId)
      : undefined
    if (!providerConfig) {
      throw new Error(`No active provider with API key for notebook chat (provider: ${input.providerId})`)
    }
  } else {
    const resolution = resolveSummaryConfigFromSettings(providers, globalModels, modelId)
    if (!resolution.ok) throw new Error('dialogue-not-configured')
    providerConfig = resolution.providerConfig
  }

  const model = AIProviderRegistry.getInstance()
    .getOrUpdateProvider(prepareProviderConfigForRuntime(providerConfig))
    .getLanguageModel(modelId)

  const collected: NotebookChatCitation[] = []
  const rawReader = createDesktopKnowledgeReader()
  if (!rawReader) {
    logger.warn('[NotebookChat] knowledgeReader unavailable; notebook search cannot run')
  }
  const knowledgeReader = rawReader
    ? {
        search: async (opts: { query: string; notebookId: string; limit?: number }) => {
          const hits = await rawReader.search(opts)
          const next = citationsFromKnowledgeHits(hits)
          if (next.length > 0) {
            collected.splice(0, collected.length, ...next)
          }
          return hits
        }
      }
    : undefined
  const knowledgeGraphReader = createDesktopKnowledgeGraphReader()
  const webSearchConfig = await settingsManager.get<WebSearchConfig>('web_search_config')
  const storedSearchMode = await settingsManager.get<boolean>('search_mode_enabled')
  const webSearchEnabled = resolveWebSearchEnabled(input.searchMode, storedSearchMode)
  const userConfig = {
    web_search_enabled: webSearchEnabled,
    ...webSearchConfigToUserConfig(webSearchConfig)
  }

  const context = {
    sessionId: `notebook:${notebookId}`,
    vaultId: resolveActiveVaultId() || 'vault',
    vaultName: 'notebook',
    knowledgeReader,
    knowledgeGraphReader,
    userConfig,
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage(),
    workspace: {
      folderRoot: '',
      sessionKind: 'companion',
      notebookId
    }
  } as ToolContext

  const tools: Record<string, unknown> = {
    knowledge_search: new KnowledgeSearchTool().toVercelTool(context),
    knowledge_graph_search: new KnowledgeGraphSearchTool().toVercelTool(context)
  }
  if (resolveNotebookWebSearchToolIds(webSearchEnabled).includes('web_search')) {
    tools.web_search = new WebSearchTool().toVercelTool(context)
    tools.url_read = new UrlReadTool().toVercelTool(context)
  }

  const history = input.history
    .filter((row) => row.text.trim())
    .slice(-20)
    .map((row) => ({ role: row.role, content: row.text }))
  const hasQuestion =
    history.length > 0 &&
    history[history.length - 1]?.role === 'user' &&
    history[history.length - 1]?.content === question
  const messages = hasQuestion ? history : [...history, { role: 'user' as const, content: question }]

  const toolsState: NotebookAskToolState[] = []
  const emit = (event: Omit<NotebookAskProgress, 'notebookId'>) => {
    input.onProgress?.({
      ...event,
      tools: toolsState.map((row) => ({ ...row }))
    })
  }

  let prefetchBlock = ''
  if (knowledgeReader && shouldRetrieveNotebookSources(question)) {
    emit({ phase: 'retrieving' })
    try {
      const hits = await knowledgeReader.search({ query: question, notebookId, limit: 8 })
      prefetchBlock = formatKnowledgeSearchHits(question, hits)
      logger.info(
        `[NotebookChat] Prefetched ${hits.length} hit(s) for notebook ${notebookId}`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message === 'embedding-not-configured' || message === 'knowledge-model-mismatch') {
        throw error
      }
      logger.warn(`[NotebookChat] Prefetch failed for notebook ${notebookId}: ${message}`)
    }
  }

  const system = [
    input.partnerName ? `你正在以伙伴「${input.partnerName}」的身份回答这本笔记本里的问题。` : '',
    input.systemPrompt || '',
    NOTEBOOK_AGENT_SYSTEM,
    buildNotebookWebSearchSystem(webSearchEnabled),
    prefetchBlock ? `本轮已按当前笔记本检索，资料如下。\n\n${prefetchBlock}` : ''
  ]
    .filter(Boolean)
    .join('\n\n')

  const providerOptions = input.reasoningEffort
    ? buildReasoningProviderOptions({
        modelId,
        providerType: providerConfig.type || providerConfig.id,
        effort: normalizeReasoningEffortSetting(input.reasoningEffort)
      })
    : undefined

  logger.info(`[NotebookChat] Starting tool-calling ask for notebook ${notebookId}`)
  emit({ phase: 'thinking' })

  const streamResult = streamText({
    model,
    system,
    messages,
    tools,
    stopWhen: stepCountIs(8),
    abortSignal: input.abortSignal,
    ...(providerOptions ? { providerOptions } : {})
  } as never)

  let text = ''
  let reasoning = ''
  let lastToolName = ''
  for await (const value of iterateUnknownStream(streamResult.fullStream ?? streamResult.stream)) {
    if (input.abortSignal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }
    const next = applyNotebookAgentStreamPart((value ?? {}) as never, {
      text,
      reasoning,
      lastToolName
    })
    text = next.text
    reasoning = next.reasoning
    if (next.lastToolName) lastToolName = next.lastToolName
    if (next.tool) {
      upsertNotebookAskTool(toolsState, next.tool)
      emit({
        phase: 'tool',
        text,
        reasoning,
        toolName: next.tool.name,
        toolStatus: next.tool.status
      })
    } else if (reasoning && !text) {
      emit({ phase: 'thinking', text, reasoning })
    } else if (text) {
      emit({ phase: 'answering', text, reasoning })
    }
  }

  return {
    answer:
      text.trim() ||
      (toolsState.length > 0
        ? '我查过这本笔记本，但没有形成可用回答。请换一种问法。'
        : ''),
    reasoning: reasoning.trim() || undefined,
    citations: collected
  }
}

function upsertNotebookAskTool(
  tools: NotebookAskToolState[],
  incoming: { name: string; status: NotebookAskToolState['status']; result?: string }
): void {
  const displayName = TOOL_LABELS[incoming.name] || incoming.name
  const existing = tools.find((row) => row.name === incoming.name && row.status === 'running')
  if (existing) {
    existing.status = incoming.status
    existing.displayName = displayName
    if (incoming.result) existing.result = incoming.result
    return
  }
  tools.push({
    name: incoming.name,
    displayName,
    status: incoming.status,
    result: incoming.result
  })
}

async function* iterateUnknownStream(stream: unknown): AsyncGenerator<unknown> {
  if (!stream) return
  if (typeof (stream as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    yield* stream as AsyncIterable<unknown>
    return
  }
  const reader = (stream as { getReader?: () => { read: () => Promise<{ done: boolean; value?: unknown }>; releaseLock: () => void } })
    .getReader?.()
  if (!reader) return
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}
