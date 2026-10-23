import { loadContextAtMessage } from '../../services/mobile-context-at-message.service'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { webFetchContent, fetchSearchPageHtml } from './web-fetch'
import type { IBaishouAgentGate, ToolRegistry, ToolDiarySearcher } from '@baishou/ai'

export function createGetContextAtMessage(deps: {
  toolRegistry: ToolRegistry
  agentDbRuntimeRef: typeof agentDbRuntimeRef
  getDiarySearcher: () => ToolDiarySearcher | undefined
  getAgentGate?: () => IBaishouAgentGate | undefined
}) {
  const { toolRegistry, getDiarySearcher, getAgentGate } = deps
  return (sessionId: string, messageId: string, searchMode = false) => {
    const runtime = agentDbRuntimeRef.current
    if (!runtime) {
      return Promise.resolve({ messages: [], totalTokens: 0 } as never)
    }
    return loadContextAtMessage(
      {
        sessionRepo: runtime.sessionRepo,
        snapshotRepo: runtime.snapshotRepo,
        assistantManager: runtime.assistantManager,
        settingsManager: runtime.settingsManager,
        toolRegistry,
        diarySearcher: getDiarySearcher(),
        webSearchResultFetcher: webFetchContent,
        fetchSearchPage: fetchSearchPageHtml,
        getAgentGate
      },
      sessionId,
      messageId,
      searchMode
    )
  }
}
