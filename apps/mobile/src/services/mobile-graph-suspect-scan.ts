import {
  collectSuspectSignals,
  GRAPH_SUSPECT_LLM_CAP,
  readSuspectReason,
  runGraphSuspectScan,
  toSuspectScanEdge,
  toSuspectScanNode
} from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import {
  logger,
  resolveGlobalGraphModelIds,
  resolveReasoningEffortForSlot,
  type GlobalModelsConfig
} from '@baishou/shared'
import { agentDbRuntimeRef } from './mobile-agent-db-runtime-ref'
import { createMobileFileSystem } from './create-mobile-file-system'
import { syncMobileGraphPendingIndex } from './mobile-raw-data-source.runtime'
import { buildMobileSummaryAiClient } from './mobile-summary-ai-client'
import { writeMobileNodeSuspectReason } from './mobile-graph.service'

export async function runMobileGraphSuspectScan(input: {
  vaultId: string
}): Promise<{ collected: number; persisted: number }> {
  const runtime = agentDbRuntimeRef.current
  const drizzleDb = runtime?.drizzleDb
  const settingsManager = runtime?.settingsManager
  const pathService = runtime?.pathService
  if (!drizzleDb || !settingsManager || !pathService) {
    logger.warn('[GraphSuspectScan] mobile runtime missing, skip persist')
    return { collected: 0, persisted: 0 }
  }
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const { providerId, modelId } = resolveGlobalGraphModelIds(globalModels)
  if (!providerId || !modelId) {
    logger.warn('[GraphSuspectScan] graph model missing, skip persist')
    return { collected: 0, persisted: 0 }
  }

  const repo = new GraphRepository(drizzleDb)
  const scan = await repo.listLiveScanGraph(input.vaultId)
  const nodes = scan.nodes.map(toSuspectScanNode)
  const edges = scan.edges.map(toSuspectScanEdge)
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const pendingHits = collectSuspectSignals(nodes, edges).filter((hit) => {
    const node = nodeById.get(hit.nodeId)
    return Boolean(node && !readSuspectReason(node.props))
  })
  if (pendingHits.length === 0) return { collected: 0, persisted: 0 }

  const fileSystem = createMobileFileSystem()
  const summaryClient = buildMobileSummaryAiClient(settingsManager)
  const result = await runGraphSuspectScan({
    nodes,
    edges,
    maxLlmCalls: GRAPH_SUSPECT_LLM_CAP,
    llm: async (prompt) => {
      // 必须带上图抽取槽位的服务商，否则会落到记忆总结槽位
      const text = await summaryClient.generateContent(prompt.user, modelId, {
        providerId,
        system: prompt.system,
        reasoningEffort: resolveReasoningEffortForSlot(globalModels?.reasoningEffortBySlot, 'graph')
      })
      return text ?? null
    },
    persist: async (node, reason) => {
      await writeMobileNodeSuspectReason({
        drizzleDb,
        pathService,
        fileSystem,
        nodeId: node.id,
        reason
      })
    }
  })
  if (result.persisted > 0) {
    await syncMobileGraphPendingIndex({ drizzleDb })
  }
  return result
}
