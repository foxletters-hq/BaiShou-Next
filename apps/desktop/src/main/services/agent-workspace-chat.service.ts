import {
  AgentChatCoreService,
  AgentRoundCheckpointService,
  createNodeWorkspaceFs
} from '@baishou/ai'
import {
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  logger,
  type BaishouAgentGateConfig,
  buildAgentDialogueSelectionState,
  resolveDialogueModelSelection,
  toStorageDialogueIds,
  type GlobalModelsConfig
} from '@baishou/shared'
import type { IpcMainInvokeEvent } from 'electron'
import { ElectronStreamEmitter } from '../ipc/electron-stream-emitter'
import {
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
import { getAgentGate } from './agent-gate.service'
import {
  bindWorkspaceSession,
  getWorkspaceCheckpointForUserMessage,
  getWorkspaceSessionBinding,
  loadSessionCheckpointsIntoService,
  saveWorkspaceCheckpoint,
  touchWorkspaceSession,
  updateWorkspaceSessionSelection
} from './agent-workspace-session.store'
import {
  pushActiveWorkspaceStreamSessionId,
  removeActiveWorkspaceStreamSessionId
} from './agent-workspace-tool-context'
import { AgentChatService } from '../ipc/AgentChatService'

const checkpointService = new AgentRoundCheckpointService(createNodeWorkspaceFs())

export async function createWorkspaceAgentSession(params: {
  id: string
  folderRoot: string
  assistantId?: string
  title?: string
}): Promise<string> {
  const { sessionManager, assistantManager } = getAgentManagers()

  let vaultName = 'Personal'
  try {
    const { vaultService } = await import('../ipc/vault.ipc')
    const active = vaultService.getActiveVault()
    if (active?.name) vaultName = active.name
  } catch {
    /* use default */
  }

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
    globalDialogueProviderId: globalModels?.globalDialogueProviderId,
    globalDialogueModelId: globalModels?.globalDialogueModelId
  })
  const storageIds = toStorageDialogueIds(resolved)

  await sessionManager.upsertSession({
    id: params.id,
    vaultName,
    providerId: storageIds.providerId,
    modelId: storageIds.modelId,
    assistantId: params.assistantId,
    title: params.title || '工作区对话'
  } as never)

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
  skipUserMessageRecording?: boolean
}): Promise<void> {
  const binding = await getWorkspaceSessionBinding(params.sessionId)
  if (!binding?.folderRoot) {
    throw new Error('Workspace folder is not configured for this session')
  }

  const folderRoot = binding.folderRoot
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
    false,
    assistantContextWindow
  )

  pushActiveWorkspaceStreamSessionId(params.sessionId)
  invalidateMcpToolContextCache()
  try {
    let roundCheckpointId: string | undefined
    if (params.userMessageId) {
      const checkpoint = await checkpointService.capturePaths({
        sessionId: params.sessionId,
        userMessageId: params.userMessageId,
        folderRoot,
        paths: []
      })
      roundCheckpointId = checkpoint.id
      await saveWorkspaceCheckpoint(checkpoint)
    }

    const emitter = new ElectronStreamEmitter(params.event)
    const agentGate = await getAgentGate()

    await AgentChatCoreService.runStreamChat({
    emitter,
    sessionId: params.sessionId,
    userText: params.userText,
    userMessageId: params.userMessageId,
    provider,
    modelId: resolved.modelId,
    systemModels,
    userConfig: {
      ...userConfig,
      workspaceSystemHint: `当前工作文件夹根路径：${folderRoot}。仅使用 workspace_* 工具读写该目录内文件。`
    },
    skipUserMessageRecording: params.skipUserMessageRecording,
    realSessionRepo,
    realSnapshotRepo,
    toolRegistry,
    diarySearcher: createDiarySearcher(),
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage(),
    agentGate,
    persistBaishouAgentGateConfig: async (config: BaishouAgentGateConfig) => {
      await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, config)
    },
    workspace: {
      folderRoot,
      sessionKind: 'workspace',
      fs: createNodeWorkspaceFs(),
      roundCheckpointService: checkpointService,
      roundCheckpointId
    }
  })
    await touchWorkspaceSession(params.sessionId)
    const session = await realSessionRepo.getSessionById(params.sessionId)
    await updateWorkspaceSessionSelection(
      params.sessionId,
      buildAgentDialogueSelectionState({
        assistantId: session?.assistantId,
        resolved
      })
    )
  } finally {
    removeActiveWorkspaceStreamSessionId(params.sessionId)
    invalidateMcpToolContextCache()
  }
}

export async function rollbackWorkspaceRound(params: {
  sessionId: string
  userMessageId: string
}): Promise<{ restored: string[]; deleted: string[]; skipped: string[] }> {
  const binding = await getWorkspaceSessionBinding(params.sessionId)
  if (!binding?.folderRoot) {
    throw new Error('Workspace session binding not found')
  }

  let checkpoint = await getWorkspaceCheckpointForUserMessage(
    params.sessionId,
    params.userMessageId
  )
  if (!checkpoint) {
    await loadSessionCheckpointsIntoService(params.sessionId, checkpointService)
    checkpoint = await getWorkspaceCheckpointForUserMessage(
      params.sessionId,
      params.userMessageId
    )
  }
  if (!checkpoint) {
    throw new Error('Round checkpoint not found')
  }

  const result = await checkpointService.rollback(checkpoint.id, binding.folderRoot)
  await saveWorkspaceCheckpoint(checkpoint)
  await touchWorkspaceSession(params.sessionId)
  logger.info(
    `[WorkspaceChat] rollback session=${params.sessionId} userMessage=${params.userMessageId}`,
    { ...result }
  )
  return result
}

export function getWorkspaceCheckpointService(): AgentRoundCheckpointService {
  return checkpointService
}
