import { buildSystemPromptForSession, filterSkillsCatalogByGate } from '@baishou/ai'
import {
  getAgentManagers,
  toolRegistry,
  createDiarySearcher,
  createWebSearchResultFetcher,
  createFetchSearchPage,
  buildStreamConfig
} from './agent-helpers'
import { AgentChatService } from './AgentChatService'
import { buildCompanionStreamHost } from './companion-stream-host'
import { getWorkspaceAgentGate } from '../services/agent-gate.service'
import { getWorkspaceSessionBinding } from '../services/agent-workspace-session.store'
import { resolveOrCreateWorkspaceIdByFolder } from '../services/agent-workspace-registry.store'
import {
  getWorkspaceGateConfig,
  getWorkspacePersonalMemoryRead,
  getWorkspaceToolManagement
} from '../services/agent-workspace-policy.store'
import { resolveWorkspaceGitMetaLight } from '../services/workspace-chat-git-meta'
import { listAgentSkillsCatalogForWorkspace } from '../services/agent-skills.service'
import { readSessionMountedNotebookIds } from '../services/session-mounted-notebooks'
import {
  createDesktopSkillsReader,
  createDesktopSkillsWriter
} from '../services/desktop-skills-writer'
import { createDesktopKnowledgeReader } from '../services/desktop-knowledge-reader'
import {
  AgentGateProfileId,
  type GlobalModelsConfig,
  resolveDialogueModelSelection,
  resolveWebSearchEnabled
} from '@baishou/shared'
import { settingsManager } from './settings.ipc'

async function resolveSearchModeEnabled(explicit?: boolean): Promise<boolean> {
  const stored = await settingsManager.get<boolean>('search_mode_enabled')
  return resolveWebSearchEnabled(explicit, stored)
}

export async function buildAgentSystemPrompt(
  sessionId: string,
  searchMode?: boolean
): Promise<string> {
  const { realSessionRepo, realAssistantRepo } = getAgentManagers()
  const session = await realSessionRepo.getSessionById(sessionId)
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const resolvedDialogue = resolveDialogueModelSelection({
    requestedProviderId: session?.providerId,
    requestedModelId: session?.modelId,
    globalDialogueProviderId: globalModels?.globalDialogueProviderId,
    globalDialogueModelId: globalModels?.globalDialogueModelId
  })
  const prefs = await AgentChatService.getAssistantSessionPrefs(sessionId)
  const webSearchEnabled = await resolveSearchModeEnabled(searchMode)
  const { provider, systemModels, userConfig } = await buildStreamConfig(
    resolvedDialogue.providerId ?? undefined,
    resolvedDialogue.modelId ?? undefined,
    webSearchEnabled,
    prefs.assistantContextWindow,
    prefs.assistantEmojiPrefs
  )

  const modelId = resolvedDialogue.modelId || ''
  const { desktopExtraVercelToolsFactory } = await import('../services/mcp-client-runtime')
  const binding = await getWorkspaceSessionBinding(sessionId)

  if (binding?.folderRoot) {
    const folderRoot = binding.folderRoot
    const workspaceId = await resolveOrCreateWorkspaceIdByFolder(folderRoot)
    const [workspaceGateConfig, workspaceTools, personalMemoryReadEnabled, agentGate, notebookIds] =
      await Promise.all([
        getWorkspaceGateConfig(workspaceId),
        getWorkspaceToolManagement(workspaceId),
        getWorkspacePersonalMemoryRead(workspaceId),
        getWorkspaceAgentGate(workspaceId),
        readSessionMountedNotebookIds(sessionId)
      ])

    let gitMeta: {
      isGitRepo: boolean
      gitBranch?: string | null
      gitChangesCount?: number | null
    } = { isGitRepo: false }
    try {
      gitMeta = await resolveWorkspaceGitMetaLight(folderRoot)
    } catch {
      gitMeta = { isGitRepo: false }
    }

    let skillsCatalog: Array<{ name: string; description?: string }> | undefined
    try {
      skillsCatalog = filterSkillsCatalogByGate(
        await listAgentSkillsCatalogForWorkspace(folderRoot),
        { agentGate, profileId: AgentGateProfileId.Workspace }
      )
    } catch {
      skillsCatalog = undefined
    }

    const { createDesktopKnowledgeGraphReader } =
      await import('../services/desktop-knowledge-graph-reader')
    const { getRawDataSourceManager, syncGraphPendingIndex } =
      await import('../services/raw-data-source.runtime')

    return buildSystemPromptForSession({
      sessionId,
      sessionRepo: realSessionRepo,
      assistantRepo: {
        findById: async (id) => (await realAssistantRepo.findById(id)) ?? null
      },
      userConfig: {
        ...(userConfig as Record<string, unknown>),
        disabledToolIds: workspaceTools.disabledToolIds,
        baishou_agent_gate_config: workspaceGateConfig,
        workspaceId,
        personalMemoryReadEnabled
      },
      provider,
      modelId,
      systemModels: systemModels as any,
      toolRegistry,
      diarySearcher: createDiarySearcher(),
      webSearchResultFetcher: createWebSearchResultFetcher(),
      fetchSearchPage: createFetchSearchPage(),
      rawDataSourceManager: getRawDataSourceManager(),
      syncGraphPendingIndex,
      knowledgeReader: createDesktopKnowledgeReader(),
      knowledgeGraphReader: createDesktopKnowledgeGraphReader(),
      skillsWriter: createDesktopSkillsWriter({ folderRoot }),
      skillsReader: createDesktopSkillsReader({ folderRoot }),
      skillsCatalog,
      extraVercelToolsFactory: desktopExtraVercelToolsFactory,
      agentGate,
      gateProfile: AgentGateProfileId.Workspace,
      workspace: {
        folderRoot,
        sessionKind: 'workspace',
        notebookIds,
        env: {
          platform: process.platform,
          isGitRepo: gitMeta.isGitRepo,
          gitBranch: gitMeta.gitBranch,
          gitChangesCount: gitMeta.gitChangesCount
        }
      }
    })
  }

  const companionHost = await buildCompanionStreamHost({
    sessionId,
    systemModels
  })

  return buildSystemPromptForSession({
    sessionId,
    sessionRepo: realSessionRepo,
    assistantRepo: {
      findById: async (id) => (await realAssistantRepo.findById(id)) ?? null
    },
    userConfig: userConfig as Record<string, unknown>,
    provider,
    modelId,
    systemModels: systemModels as any,
    toolRegistry,
    diarySearcher: createDiarySearcher(),
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage(),
    rawDataSourceManager: companionHost.rawDataSourceManager,
    syncGraphPendingIndex: companionHost.syncGraphPendingIndex,
    deleteGraphRecord: companionHost.deleteGraphRecord,
    graphReader: companionHost.graphReader,
    graphNodeLookup: companionHost.graphNodeLookup,
    graphEdgeLookup: companionHost.graphEdgeLookup,
    knowledgeReader: companionHost.knowledgeReader,
    knowledgeGraphReader: companionHost.knowledgeGraphReader,
    skillsWriter: companionHost.skillsWriter,
    skillsReader: companionHost.skillsReader,
    skillsCatalog: companionHost.skillsCatalog,
    extraVercelToolsFactory: desktopExtraVercelToolsFactory,
    agentGate: companionHost.agentGate as any,
    resolveVaultDisplayName: companionHost.resolveVaultDisplayName,
    workspace: companionHost.workspace
  })
}
