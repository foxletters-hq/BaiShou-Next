import {
  collectSuspectSignals,
  GRAPH_SUSPECT_LLM_CAP,
  readSuspectReason,
  runGraphSuspectScan,
  toSuspectScanEdge,
  toSuspectScanNode
} from '@baishou/core-desktop'
import { GraphRepository } from '@baishou/database-desktop'
import {
  logger,
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  type GlobalModelsConfig
} from '@baishou/shared'
import { buildSummaryAiClient } from '../ipc/summary-ai-client'
import { writeNodeSuspectReason } from '../ipc/graph-review.write'
import { settingsManager } from '../ipc/settings.ipc'
import { syncGraphPendingIndex } from './raw-data-source.runtime'

export async function runDesktopGraphSuspectScan(input: {
  vaultId: string
  repo: GraphRepository
  onProgress?: (progress: { completed: number; total: number }) => void
}): Promise<{ collected: number; persisted: number }> {
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const { modelId } = resolveGlobalGraphModelIds(globalModels)
  if (!modelId) {
    logger.warn('[GraphSuspectScan] graph model missing, skip persist')
    return { collected: 0, persisted: 0 }
  }
  const scan = await input.repo.listLiveScanGraph(input.vaultId)
  const nodes = scan.nodes.map(toSuspectScanNode)
  const edges = scan.edges.map(toSuspectScanEdge)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const pendingHits = collectSuspectSignals(nodes, edges).filter((hit) => {
    const node = nodeById.get(hit.nodeId)
    return Boolean(node && !readSuspectReason(node.props))
  })
  const total = Math.min(GRAPH_SUSPECT_LLM_CAP, pendingHits.length)
  input.onProgress?.({ completed: 0, total })
  if (total === 0) return { collected: pendingHits.length, persisted: 0 }
  const summaryClient = buildSummaryAiClient()
  let llmDone = 0
  const result = await runGraphSuspectScan({
    nodes,
    edges,
    maxLlmCalls: GRAPH_SUSPECT_LLM_CAP,
    llm: async (prompt) => {
      const text = await summaryClient.generateContent(prompt.user, modelId, {
        system: prompt.system,
        reasoningEffort: resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
      })
      llmDone += 1
      input.onProgress?.({ completed: llmDone, total })
      return text ?? null
    },
    persist: async (node, reason) => {
      await writeNodeSuspectReason(node.id, reason)
    }
  })
  if (result.persisted > 0) {
    await syncGraphPendingIndex()
  }
  return result
}
