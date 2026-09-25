import { AgentChatCoreService, createNodeWorkspaceFs, emitAgentSessionRuntime } from '@baishou/ai'
import {
  logger,
  type BaishouAgentGateConfig,
  buildAgentDialogueSelectionState,
  isAgentStreamAbortError,
  resolveDialogueModelSelection,
  toStorageDialogueIds,
  type GlobalModelsConfig
} from '@baishou/shared'
import type { IpcMainInvokeEvent } from 'electron'
import i18n from 'i18next'
import { ElectronStreamEmitter } from '../ipc/electron-stream-emitter'
import {
  applySessionReasoningEffort,
  buildStreamConfig,
  createDiarySearcher,
  createFetchSearchPage,
  createWebSearchResultFetcher,
  getAgentManagers,
  invalidateMcpToolContextCache,
  resolveStreamDialogueSelection,
  toolRegistry
} from '../ipc/agent-helpers'
import { settingsManager } from '../ipc/settings.ipc'
import { getWorkspaceAgentGate } from './agent-gate.service'
import { createDesktopSkillsWriter } from './desktop-skills-writer'
import { desktopExtraVercelToolsFactory } from './mcp-client-runtime'
import { listAgentSkillsCatalogForWorkspace } from './agent-skills.service'
import {
  bindWorkspaceSession,
  getWorkspaceSessionBinding,
  loadSessionCheckpointsIntoService,
  saveWorkspaceCheckpoint,
  touchWorkspaceSession,
  updateWorkspaceSessionSelection
} from './agent-workspace-session.store'
import { resolveOrCreateWorkspaceIdByFolder } from './agent-workspace-registry.store'
import {
  getWorkspaceGateConfig,
  getWorkspacePersonalMemoryRead,
  getWorkspaceToolManagement,
  setWorkspaceGateConfig
} from './agent-workspace-policy.store'
import {
  pushActiveWorkspaceStreamSessionId,
  removeActiveWorkspaceStreamSessionId
} from './agent-workspace-tool-context'
import { createDesktopKnowledgeReader } from './desktop-knowledge-reader'
import { AgentChatService } from '../ipc/AgentChatService'
import { resolveActiveVaultId } from '../ipc/vault.ipc'
import { broadcastWorkspaceFsChanged } from './workspace-folder-watcher.service'
import { resolveWorkspaceGitMetaLight } from './workspace-chat-git-meta'
import { drainWorkspaceInbox } from './workspace-chat-inbox'
import { checkpointService, finalizeRoundCheckpoint } from './workspace-chat-runtime'

export { getWorkspaceCheckpointService } from './workspace-chat-runtime'
export {
  admitWorkspaceInput,
  cancelWorkspacePendingInput,
  listWorkspacePendingInputs
} from './workspace-chat-inbox'
export {
  previewWorkspaceRollback,
  removeWorkspaceSessionWithCheckpoints,
  rollbackWorkspaceRound
} from './workspace-chat-rollback'

export async function createWorkspaceAgentSession(params: {
  id: string
  folderRoot: string
  assistantId?: string
  title?: string
  providerId?: string
  modelId?: string
}): Promise<string> {
  const { sessionManager, assistantManager } = getAgentManagers()

  const vaultId = resolveActiveVaultId()

  let assistantProviderId: string | undefined
  let assistantModelId: string | undefined
  if (params.assistantId) {
    const assistant = await assistantManager.findById(params.assistantId)
    if (assistant) {
      assistantProviderId = assistant.providerId ?? undefined
      assistantModelId = assistant.modelId ?? undefined
    }
  }

  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  const resolved = resolveDialogueModelSelection({
    assistantProviderId,
    assistantModelId,
    requestedProviderId: params.providerId,
    requestedModelId: params.modelId,
    globalDialogueProviderId: globalModels?.globalDialogueProviderId,
    globalDialogueModelId: globalModels?.globalDialogueModelId
  })
  const storageIds = toStorageDialogueIds(resolved)

  await sessionManager.upsertSession({
    id: params.id,
    vaultId,
    providerId: storageIds.providerId,
    modelId: storageIds.modelId,
    assistantId: params.assistantId,
    title: params.title || i18n.t('agent_workspace.default_session_title', '工作区对话')
  })

  // 冲突更新路径也要对齐活跃仓，避免历史错误 vault_id 导致读消息被拒
  const { realSessionRepo } = getAgentManagers()
  await realSessionRepo.updateSessionVaultId(params.id, vaultId)

  await bindWorkspaceSession(params.id, params.folderRoot)
  await updateWorkspaceSessionSelection(
    params.id,
    buildAgentDialogueSelectionState({
      assistantId: params.assistantId,
      resolved
    })
  )
  await loadSessionCheckpointsIntoService(params.id, checkpointService)
  return params.id
}

export async function runWorkspaceStreamChat(params: {
  event: IpcMainInvokeEvent
  sessionId: string
  userText: string
  userMessageId?: string
  providerId?: string
  modelId?: string
  reasoningEffort?: string
  searchMode?: boolean
  skipUserMessageRecording?: boolean
  /** 内部 drain 循环调用时跳过 finally 再入队，避免与锁冲突 */
  skipInboxDrain?: boolean
}): Promise<void | 'aborted'> {
  const binding = await getWorkspaceSessionBinding(params.sessionId)
  if (!binding?.folderRoot) {
    throw new Error('Workspace folder is not configured for this session')
  }

  const folderRoot = binding.folderRoot
  const workspaceId = await resolveOrCreateWorkspaceIdByFolder(folderRoot)
  const { realSessionRepo, realSnapshotRepo } = getAgentManagers()
  const assistantContextWindow = await AgentChatService.getAssistantContextWindow(params.sessionId)

  const resolved = await resolveStreamDialogueSelection({
    sessionId: params.sessionId,
    requestedProviderId: params.providerId,
    requestedModelId: params.modelId
  })

  const { provider, systemModels, userConfig } = await buildStreamConfig(
    resolved.providerId,
    resolved.modelId,
    params.searchMode,
    assistantContextWindow
  )

  const mergedUserConfig = applySessionReasoningEffort(
    userConfig as Record<string, unknown>,
    params.reasoningEffort
  )

  const [workspaceGateConfig, workspaceTools, personalMemoryReadEnabled] = await Promise.all([
    getWorkspaceGateConfig(workspaceId),
    getWorkspaceToolManagement(workspaceId),
    getWorkspacePersonalMemoryRead(workspaceId)
  ])

  pushActiveWorkspaceStreamSessionId(params.sessionId)
  invalidateMcpToolContextCache()
  /** 正常结束才 drain；Stop/abort 不排空 inbox；drain 内层调用跳过 */
  let shouldDrainInbox = !params.skipInboxDrain
  let roundCheckpointId: string | undefined
  try {
    if (params.userMessageId) {
      try {
        const checkpoint = await checkpointService.capturePaths({
          sessionId: params.sessionId,
          userMessageId: params.userMessageId,
          folderRoot,
          paths: []
        })
        roundCheckpointId = checkpoint.id
        await saveWorkspaceCheckpoint(checkpoint)
      } catch (error) {
        logger.warn(
          `[WorkspaceChat] round start snapshot failed; this round will not be rollbackable session=${params.sessionId}:`,
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    const emitter = new ElectronStreamEmitter(params.event)
    const agentGate = await getWorkspaceAgentGate(workspaceId)
    const knowledgeReader = createDesktopKnowledgeReader()
    const { createDesktopKnowledgeGraphReader } = await import('./desktop-knowledge-graph-reader')
    const knowledgeGraphReader = createDesktopKnowledgeGraphReader()
    const { readSessionMountedNotebookIds } = await import('./session-mounted-notebooks')
    const notebookIds = await readSessionMountedNotebookIds(params.sessionId)

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
      skillsCatalog = await listAgentSkillsCatalogForWorkspace(folderRoot)
    } catch {
      skillsCatalog = undefined
    }

    const { getRawDataSourceManager, syncGraphPendingIndex } =
      await import('./raw-data-source.runtime')

    const streamResult = await AgentChatCoreService.runStreamChat({
      emitter,
      sessionId: params.sessionId,
      userText: params.userText,
      userMessageId: params.userMessageId,
      provider,
      modelId: resolved.modelId,
      systemModels,
      userConfig: {
        ...mergedUserConfig,
        // 工作区使用独立工具开关与门控配置，不共享伙伴 Vault 配置
        disabledToolIds: workspaceTools.disabledToolIds,
        baishou_agent_gate_config: workspaceGateConfig,
        workspaceId,
        personalMemoryReadEnabled
      },
      skipUserMessageRecording: params.skipUserMessageRecording,
      realSessionRepo,
      realSnapshotRepo,
      toolRegistry,
      diarySearcher: createDiarySearcher(),
      skillsWriter: createDesktopSkillsWriter({ folderRoot }),
      webSearchResultFetcher: createWebSearchResultFetcher(),
      fetchSearchPage: createFetchSearchPage(),
      agentGate,
      persistBaishouAgentGateConfig: async (config: BaishouAgentGateConfig) => {
        await setWorkspaceGateConfig(workspaceId, config)
      },
      rawDataSourceManager: getRawDataSourceManager(),
      syncGraphPendingIndex,
      knowledgeReader,
      knowledgeGraphReader,
      skillsCatalog,
      extraVercelToolsFactory: desktopExtraVercelToolsFactory,
      workspace: {
        folderRoot,
        sessionKind: 'workspace',
        notebookIds,
        workspaceId,
        env: {
          platform: process.platform,
          isGitRepo: gitMeta.isGitRepo,
          gitBranch: gitMeta.gitBranch,
          gitChangesCount: gitMeta.gitChangesCount
        },
        fs: createNodeWorkspaceFs(),
        roundCheckpointService: checkpointService,
        roundCheckpointId,
        onFileChange: (change) => {
          broadcastWorkspaceFsChanged({
            folderRoot,
            sessionId: params.sessionId,
            path: change.path,
            kind: change.kind,
            previousPath: change.previousPath
          })
        }
      }
    })

    if (streamResult.aborted) {
      shouldDrainInbox = false
      emitAgentSessionRuntime({
        type: 'session.idle',
        sessionId: params.sessionId,
        timestamp: Date.now()
      })
      return 'aborted'
    }

    await touchWorkspaceSession(params.sessionId)
    const session = await realSessionRepo.getSessionById(params.sessionId)
    await updateWorkspaceSessionSelection(
      params.sessionId,
      buildAgentDialogueSelectionState({
        assistantId: session?.assistantId,
        resolved
      })
    )
  } catch (error) {
    if (isAgentStreamAbortError(error)) {
      shouldDrainInbox = false
      emitAgentSessionRuntime({
        type: 'session.idle',
        sessionId: params.sessionId,
        timestamp: Date.now()
      })
      return 'aborted'
    }
    throw error
  } finally {
    // 正常结束、用户中断、异常退出都要收尾：三条路径的磁盘状态同样需要能回滚
    if (roundCheckpointId) {
      await finalizeRoundCheckpoint(roundCheckpointId, folderRoot)
    }
    removeActiveWorkspaceStreamSessionId(params.sessionId)
    invalidateMcpToolContextCache()
    // 仅正常结束 / 非用户 abort 时排空 inbox；Stop 后保留 pending 供稍后继续
    if (shouldDrainInbox) {
      void drainWorkspaceInbox(params.event, params.sessionId)
    }
  }
}
