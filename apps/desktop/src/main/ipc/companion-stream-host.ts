import { BAISHOU_AGENT_GATE_CONFIG_KEY, type BaishouAgentGateConfig } from '@baishou/shared'
import type { ActionStreamHost } from '@baishou/ai'
import { desktopExtraVercelToolsFactory } from '../services/mcp-client-runtime'
import { getAgentGate } from '../services/agent-gate.service'
import { createDesktopKnowledgeReader } from '../services/desktop-knowledge-reader'
import { createDesktopSkillsWriter } from '../services/desktop-skills-writer'
import { createDesktopGraphReader } from '../services/desktop-graph-reader'
import { settingsManager } from './settings.ipc'
import { resolveActiveVaultId, resolveVaultNameById } from './vault.ipc'

/**
 * 伙伴会话的宿主依赖。正常发送与重新生成 / 编辑 / 重发共用，
 * 少注入任何一项都会让对应工具在这一轮不可用（例如 recall_relations 拿不到读取器）。
 */
export async function buildCompanionStreamHost(params: {
  sessionId: string
  systemModels: unknown
}): Promise<ActionStreamHost> {
  const agentGate = await getAgentGate()
  const { getRawDataSourceManager, syncGraphPendingIndex } =
    await import('../services/raw-data-source.runtime')
  const { createCompanionGraphLookups, EmbeddingAdapter } = await import('@baishou/ai')
  const { connectionManager, GraphRepository } = await import('@baishou/database-desktop')

  const systemModels = params.systemModels as {
    embeddingProvider?: { getLanguageModel?: unknown } & object
    embeddingModelId?: string
  } | null
  let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
  if (systemModels?.embeddingProvider && systemModels.embeddingModelId) {
    try {
      const adapter = new EmbeddingAdapter(
        systemModels.embeddingProvider as never,
        systemModels.embeddingModelId
      )
      if (adapter.isConfigured) {
        embedQuery = (text) => adapter.embedQuery(text)
      }
    } catch {
      embedQuery = undefined
    }
  }

  const { graphNodeLookup, graphEdgeLookup } = connectionManager.isConnected()
    ? createCompanionGraphLookups(async () => {
        const repo = new GraphRepository(connectionManager.getDb())
        const vaultId = resolveActiveVaultId()
        return {
          findByNameOrAlias: async (name, nodeType) =>
            (await repo.findNodesByNameOrAlias(vaultId, name, nodeType))[0] ?? null,
          getNodeById: (id) => repo.getNodeById(id, vaultId),
          getEdgeById: (id) => repo.getEdgeById(id, vaultId)
        }
      })
    : { graphNodeLookup: undefined, graphEdgeLookup: undefined }

  const { createDesktopKnowledgeGraphReader } =
    await import('../services/desktop-knowledge-graph-reader')

  const { DesktopStoragePathService } = await import('../services/path.service')
  const { refreshDesktopAttachmentPathRemapper } = await import('./attachment-path-cache')
  await refreshDesktopAttachmentPathRemapper(new DesktopStoragePathService())

  let skillsCatalog: Array<{ name: string; description?: string }> | undefined
  try {
    const { listAgentSkillsCatalog } = await import('../services/agent-skills.service')
    skillsCatalog = await listAgentSkillsCatalog()
  } catch {
    skillsCatalog = undefined
  }

  const { readSessionMountedNotebookIds } = await import('../services/session-mounted-notebooks')
  const notebookIds = await readSessionMountedNotebookIds(params.sessionId)

  return {
    agentGate,
    persistBaishouAgentGateConfig: async (config: BaishouAgentGateConfig) => {
      await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, config)
    },
    rawDataSourceManager: getRawDataSourceManager(),
    syncGraphPendingIndex,
    deleteGraphRecord: async ({ kind, id }) => {
      if (!connectionManager.isConnected()) {
        throw new Error('Database not connected')
      }
      const { applyDiaryGraphSurgicalDelete } = await import('@baishou/core-desktop')
      const { getGraphRawManager } = await import('../services/raw-data-source.runtime')
      await applyDiaryGraphSurgicalDelete({
        kind,
        id,
        vaultId: resolveActiveVaultId(),
        manager: getGraphRawManager(),
        repo: new GraphRepository(connectionManager.getDb())
      })
    },
    graphReader: createDesktopGraphReader(embedQuery),
    graphNodeLookup,
    graphEdgeLookup,
    knowledgeReader: createDesktopKnowledgeReader(embedQuery),
    knowledgeGraphReader: createDesktopKnowledgeGraphReader(),
    skillsWriter: createDesktopSkillsWriter(),
    resolveVaultDisplayName: (vaultId) => resolveVaultNameById(vaultId),
    skillsCatalog,
    extraVercelToolsFactory: desktopExtraVercelToolsFactory,
    workspace: {
      folderRoot: '',
      sessionKind: 'companion',
      notebookIds
    }
  }
}
