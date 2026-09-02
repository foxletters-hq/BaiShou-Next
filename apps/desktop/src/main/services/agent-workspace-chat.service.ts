import {
  AgentChatCoreService,
  AgentRoundCheckpointService,
  createNodeWorkspaceFs,
  emitAgentSessionRuntime,
  getSharedSessionInbox,
  reconcileCompressionStateAfterTruncate,
  runCascadeThenTruncateSteps,
  waitForStreamIdleThenForceClear,
  clearPendingAgentStreamStop
} from '@baishou/ai'
import {
  logger,
  type AgentRoundCheckpoint,
  type BaishouAgentGateConfig,
  buildAgentDialogueSelectionState,
  isAgentStreamAbortError,
  resolveDialogueModelSelection,
  toStorageDialogueIds,
  type GlobalModelsConfig,
  type SessionInputDelivery,
  type SessionInputRecord,
  type WorkspaceRollbackPreview,
  type WorkspaceRollbackScope
} from '@baishou/shared'
import type { IpcMainInvokeEvent } from 'electron'
import i18n from 'i18next'
import { cleanupAttachmentsForParts } from '@baishou/core-desktop'
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
import { getWorkspaceFolderGitService } from './workspace-folder-git.registry'
import {
  bindWorkspaceSession,
  getWorkspaceCheckpointForUserMessage,
  getWorkspaceSessionBinding,
  loadSessionCheckpointsIntoService,
  removeWorkspaceCheckpointsForUserMessages,
  removeWorkspaceSession,
  saveWorkspaceCheckpoint,
  touchWorkspaceSession,
  updateWorkspaceSessionSelection
} from './agent-workspace-session.store'
import { resolveOrCreateWorkspaceIdByFolder } from './agent-workspace-registry.store'
import {
  cleanupUnusedWorkspaceShadowGit,
  getWorkspaceSnapshotStore
} from './workspace-shadow-git.provider'
import {
  getWorkspaceGateConfig,
  getWorkspacePersonalMemoryRead,
  getWorkspaceToolManagement,
  setWorkspaceGateConfig
} from './agent-workspace-policy.store'
import {
  isWorkspaceSessionStreaming,
  pushActiveWorkspaceStreamSessionId,
  removeActiveWorkspaceStreamSessionId
} from './agent-workspace-tool-context'
import { createDesktopKnowledgeReader } from './desktop-knowledge-reader'
import { AgentChatService } from '../ipc/AgentChatService'
import { resolveActiveVaultId } from '../ipc/vault.ipc'
import { drainSessionInbox, waitForSessionInboxDrainLock } from './session-inbox-drain'
import { initDesktopSessionInboxStore } from './session-inbox.store'

const checkpointService = new AgentRoundCheckpointService(
  createNodeWorkspaceFs(),
  getWorkspaceSnapshotStore()
)

/**
 * 轮次收尾：再拍一张快照并落盘。
 *
 * 收尾快照与开始那张做 diff，就能看出本轮到底改了什么——包括终端命令这类
 * 不经过写工具、因而没有归因记录的改动。快照失败只影响回滚能力，不该打断对话。
 */
async function finalizeRoundCheckpoint(checkpointId: string, folderRoot: string): Promise<void> {
  try {
    await checkpointService.captureRoundEnd(checkpointId, folderRoot)
  } catch (error) {
    logger.warn(
      `[WorkspaceChat] round end snapshot failed checkpoint=${checkpointId}:`,
      error instanceof Error ? error.message : String(error)
    )
  }

  try {
    const updated = checkpointService.getCheckpoint(checkpointId)
    if (updated) await saveWorkspaceCheckpoint(updated)
  } catch (error) {
    logger.warn(
      `[WorkspaceChat] persist round checkpoint failed checkpoint=${checkpointId}:`,
      error instanceof Error ? error.message : String(error)
    )
  }
}

const STREAM_IDLE_POLL_MS = 50
const STREAM_IDLE_MAX_WAIT_MS = 2000

async function waitForWorkspaceSessionStreamIdle(sessionId: string): Promise<void> {
  const { forcedClear, waitedMs } = await waitForStreamIdleThenForceClear({
    sessionId,
    isStreaming: isWorkspaceSessionStreaming,
    forceClear: removeActiveWorkspaceStreamSessionId,
    pollMs: STREAM_IDLE_POLL_MS,
    maxWaitMs: STREAM_IDLE_MAX_WAIT_MS
  })
  if (forcedClear) {
    logger.warn(
      `[WorkspaceChat] stream idle wait timed out after ${waitedMs}ms; force-cleared streaming marker session=${sessionId}`
    )
  }
}

async function clearWorkspaceSessionPendingInputs(sessionId: string): Promise<void> {
  await initDesktopSessionInboxStore()
  const cancelled = getSharedSessionInbox().cancelAllPending(sessionId)
  for (const input of cancelled) {
    const userMessageId = input.userMessageId?.trim()
    if (!userMessageId) continue
    try {
      await deleteWorkspaceQueuedUserMessage(sessionId, userMessageId)
    } catch (error) {
      logger.warn(
        `[WorkspaceChat] rollback clear pending failed to delete orphan user message session=${sessionId} userMessage=${userMessageId}:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }
}

type WorkspaceGitMetaLight = {
  isGitRepo: boolean
  gitBranch?: string | null
  gitChangesCount?: number | null
}

const GIT_META_TTL_MS = 10_000
const gitMetaCache = new Map<string, { expiresAt: number; value: WorkspaceGitMetaLight }>()

/** 轻量 git 元数据：分支名用 rev-parse；变更数用 status length；短 TTL 复用 */
async function resolveWorkspaceGitMetaLight(folderRoot: string): Promise<WorkspaceGitMetaLight> {
  const cached = gitMetaCache.get(folderRoot)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const git = getWorkspaceFolderGitService(folderRoot)
  const initialized = await git.isInitialized()
  let value: WorkspaceGitMetaLight = { isGitRepo: false }
  if (initialized) {
    const [branch, status] = await Promise.all([
      git.getCurrentBranchName().catch(() => null),
      git.getStatus().catch(() => null)
    ])
    const changesCount = status
      ? status.staged.length + status.unstaged.length + status.untracked.length
      : null
    value = {
      isGitRepo: true,
      gitBranch: branch,
      gitChangesCount: changesCount
    }
  }

  gitMetaCache.set(folderRoot, { expiresAt: Date.now() + GIT_META_TTL_MS, value })
  return value
}

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
        roundCheckpointId
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

interface WorkspaceRollbackContext {
  folderRoot: string
  followingIds: string[]
  userMessageIds: string[]
  checkpoints: AgentRoundCheckpoint[]
}

/** 收集「从这条用户消息起，往后所有轮次」的检查点，回滚与回滚预览共用 */
async function collectWorkspaceRollbackContext(params: {
  sessionId: string
  userMessageId: string
  persist: boolean
}): Promise<WorkspaceRollbackContext> {
  const binding = await getWorkspaceSessionBinding(params.sessionId)
  if (!binding?.folderRoot) {
    throw new Error('Workspace session binding not found')
  }

  const memoryCheckpointsByUserMessageId = new Map(
    checkpointService
      .getCheckpointsForSession(params.sessionId)
      .map((checkpoint) => [checkpoint.userMessageId, checkpoint] as const)
  )

  await loadSessionCheckpointsIntoService(params.sessionId, checkpointService)

  const { realSessionRepo } = getAgentManagers()
  const followingIds = await realSessionRepo.listMessageIdsFromMessageAndFollowing(
    params.sessionId,
    params.userMessageId
  )
  const followingMeta = (
    await Promise.all(
      followingIds.map(async (id) => {
        const msg = await realSessionRepo.getMessageById(id)
        if (!msg) return null
        return {
          id: String(msg.id),
          role: String(msg.role),
          orderIndex: Number(msg.orderIndex ?? 0)
        }
      })
    )
  ).filter((row): row is { id: string; role: string; orderIndex: number } => Boolean(row))

  followingMeta.sort((a, b) => a.orderIndex - b.orderIndex)
  const userMessageIds = followingMeta.filter((row) => row.role === 'user').map((row) => row.id)

  const checkpoints: AgentRoundCheckpoint[] = []
  for (const userMessageId of userMessageIds) {
    // 进程内的版本永远不会比落盘版本旧：归因路径是流式累积的，轮次收尾才写盘，
    // 而用户可能在收尾完成之前就点了回滚
    const checkpoint =
      memoryCheckpointsByUserMessageId.get(userMessageId) ??
      (await getWorkspaceCheckpointForUserMessage(params.sessionId, userMessageId))
    if (!checkpoint) continue

    checkpointService.restoreCheckpoint(checkpoint)
    if (params.persist) await saveWorkspaceCheckpoint(checkpoint)
    checkpoints.push(checkpoint)
  }

  return { folderRoot: binding.folderRoot, followingIds, userMessageIds, checkpoints }
}

/**
 * 列出回滚将要触及的文件。
 *
 * `attributedPaths` 是 AI 写工具明确碰过的路径；`changedPaths` 是这几轮里工作树
 * 实际发生的全部变化，两者之差意味着有改动不是写工具造成的——可能来自终端命令，
 * 也可能是用户同期在别的编辑器里手改的，因此要交给用户决定是否一并还原。
 */
export async function previewWorkspaceRollback(params: {
  sessionId: string
  userMessageId: string
}): Promise<WorkspaceRollbackPreview> {
  const context = await collectWorkspaceRollbackContext({ ...params, persist: false })

  const attributed = new Set<string>()
  const changed = new Set<string>()
  let diffAvailable = false

  for (const checkpoint of context.checkpoints) {
    for (const path of checkpointService.listRollbackPaths(checkpoint)) attributed.add(path)

    const roundChanges = await checkpointService
      .listRoundChangedPaths(checkpoint, context.folderRoot)
      .catch(() => null)
    if (!roundChanges) continue
    diffAvailable = true
    for (const path of roundChanges) changed.add(path)
  }

  const attributedPaths = [...attributed].sort()
  const extraPaths = diffAvailable
    ? [...changed].filter((path) => !attributed.has(path)).sort()
    : []

  return {
    snapshotKind: context.checkpoints[0]?.snapshotKind ?? 'inline',
    rounds: context.checkpoints.length,
    attributedPaths,
    extraPaths,
    changedPathsAvailable: diffAvailable
  }
}

/** 把「全集」范围拆回每一轮，让级联回滚逐轮使用各自的路径集合 */
async function resolveFullScopePaths(
  context: WorkspaceRollbackContext
): Promise<Map<string, string[]>> {
  const byCheckpointId = new Map<string, string[]>()
  for (const checkpoint of context.checkpoints) {
    const paths = new Set(checkpointService.listRollbackPaths(checkpoint))
    const roundChanges = await checkpointService
      .listRoundChangedPaths(checkpoint, context.folderRoot)
      .catch(() => null)
    for (const path of roundChanges ?? []) paths.add(path)
    byCheckpointId.set(checkpoint.id, [...paths])
  }
  return byCheckpointId
}

export async function rollbackWorkspaceRound(params: {
  sessionId: string
  userMessageId: string
  /** attributed=只撤 AI 写工具碰过的；all=连同终端命令与外部改动一起撤 */
  scope?: WorkspaceRollbackScope
}): Promise<{ restored: string[]; deleted: string[]; skipped: string[] }> {
  AgentChatService.stopStream(params.sessionId)
  await waitForWorkspaceSessionStreamIdle(params.sessionId)
  // 空闲时 stop 会留下 pending-stop；不清除的话，随后编辑重发的 claim 会立刻中止
  clearPendingAgentStreamStop(params.sessionId)

  const context = await collectWorkspaceRollbackContext({ ...params, persist: true })
  const { folderRoot, followingIds, userMessageIds, checkpoints } = context

  const { realSessionRepo, realSnapshotRepo, sessionManager, attachmentManager } =
    getAgentManagers()

  const fullScopePaths = params.scope === 'all' ? await resolveFullScopePaths(context) : null

  const result = await runCascadeThenTruncateSteps({
    cascadeRollback: async () =>
      checkpoints.length > 0
        ? checkpointService.cascadeRollback(checkpoints, folderRoot, {
            pathsFor: fullScopePaths
              ? (checkpoint) => fullScopePaths.get(checkpoint.id) ?? []
              : undefined
          })
        : { restored: [] as string[], deleted: [] as string[], skipped: [] as string[] },
    truncateMessages: async () => {
      const parts =
        followingIds.length > 0 ? await realSessionRepo.getPartsByMessageIds(followingIds) : []
      await realSessionRepo.deleteMessageAndFollowing(params.sessionId, params.userMessageId)
      await reconcileCompressionStateAfterTruncate(
        realSessionRepo,
        realSnapshotRepo,
        params.sessionId
      )
      await cleanupAttachmentsForParts(attachmentManager, params.sessionId, parts)
      await sessionManager.flushSessionToDisk(params.sessionId)
      await clearWorkspaceSessionPendingInputs(params.sessionId)
    },
    removeCheckpoints: async () => {
      await removeWorkspaceCheckpointsForUserMessages(params.sessionId, userMessageIds)
      checkpointService.removeCheckpointsForUserMessages(params.sessionId, userMessageIds)
    }
  })
  await touchWorkspaceSession(params.sessionId)
  logger.info(
    `[WorkspaceChat] rollback session=${params.sessionId} userMessage=${params.userMessageId}`,
    {
      ...result,
      messagesRemoved: followingIds.length,
      checkpointsApplied: checkpoints.length,
      cascade: checkpoints.length > 1,
      scope: params.scope ?? 'attributed'
    }
  )
  return result
}

/**
 * 删除工作台会话，连同它在内存与磁盘上的检查点。
 *
 * 只删磁盘记录是不够的：进程内的检查点表不会跟着消失，会一直占着内存到重启。
 * 影子仓库按文件夹共享，只有最后一个会话也走了才能删，否则会连累其他会话的回滚能力。
 */
export async function removeWorkspaceSessionWithCheckpoints(sessionId: string): Promise<void> {
  const binding = await getWorkspaceSessionBinding(sessionId)
  const userMessageIds = binding ? Object.keys(binding.checkpointsByUserMessageId) : []

  await removeWorkspaceSession(sessionId)
  checkpointService.removeCheckpointsForUserMessages(sessionId, userMessageIds)

  const folderRoot = binding?.folderRoot
  if (!folderRoot) return
  await cleanupUnusedWorkspaceShadowGit(folderRoot).catch(() => {})
}

export function getWorkspaceCheckpointService(): AgentRoundCheckpointService {
  return checkpointService
}

async function drainWorkspaceInbox(event: IpcMainInvokeEvent, sessionId: string): Promise<void> {
  await drainSessionInbox({
    sessionId,
    isBusy: isWorkspaceSessionStreaming,
    logLabel: 'WorkspaceChat',
    runPromoted: async (promoted) => {
      const payload = (promoted.payload ?? {}) as {
        providerId?: string
        modelId?: string
        reasoningEffort?: string
        searchMode?: boolean
      }
      const result = await runWorkspaceStreamChat({
        event,
        sessionId,
        userText: promoted.text,
        userMessageId: promoted.userMessageId,
        providerId: payload.providerId,
        modelId: payload.modelId,
        reasoningEffort: payload.reasoningEffort,
        searchMode: payload.searchMode,
        skipUserMessageRecording: Boolean(promoted.userMessageId),
        skipInboxDrain: true
      })
      return result === 'aborted' ? 'aborted' : 'ok'
    }
  })
}

export async function admitWorkspaceInput(params: {
  event: IpcMainInvokeEvent
  sessionId: string
  text: string
  delivery?: SessionInputDelivery
  userMessageId?: string
  providerId?: string
  modelId?: string
  reasoningEffort?: string
  searchMode?: boolean
  /** 渲染进程认为空闲时：清掉过期的 busy 标记并立刻开流，避免消息落库后没人干活 */
  forceStart?: boolean
}): Promise<{
  input: SessionInputRecord
  started: boolean
  queued: boolean
}> {
  await initDesktopSessionInboxStore()
  const inbox = getSharedSessionInbox()
  const delivery: SessionInputDelivery = params.delivery === 'steer' ? 'steer' : 'queue'
  const input = inbox.admit({
    sessionId: params.sessionId,
    text: params.text,
    delivery,
    userMessageId: params.userMessageId,
    payload: {
      providerId: params.providerId,
      modelId: params.modelId,
      reasoningEffort: params.reasoningEffort,
      searchMode: params.searchMode
    }
  })
  emitAgentSessionRuntime({
    type: 'session.input_queued',
    sessionId: params.sessionId,
    inputId: input.id,
    delivery,
    timestamp: Date.now()
  })

  if (params.forceStart) {
    if (isWorkspaceSessionStreaming(params.sessionId)) {
      removeActiveWorkspaceStreamSessionId(params.sessionId)
    }
    clearPendingAgentStreamStop(params.sessionId)
  }

  await waitForSessionInboxDrainLock(params.sessionId)

  if (isWorkspaceSessionStreaming(params.sessionId)) {
    return { input, started: false, queued: true }
  }

  // idle：立即 promote 并跑
  void drainWorkspaceInbox(params.event, params.sessionId)
  return { input, started: true, queued: false }
}

export async function listWorkspacePendingInputs(
  sessionId: string
): Promise<SessionInputRecord[]> {
  await initDesktopSessionInboxStore()
  return getSharedSessionInbox().listPending(sessionId)
}

async function deleteWorkspaceQueuedUserMessage(
  sessionId: string,
  userMessageId: string
): Promise<void> {
  const { realSessionRepo, realSnapshotRepo, sessionManager, attachmentManager } =
    getAgentManagers()
  const ids = await realSessionRepo.listMessageIdsFromMessageAndFollowing(sessionId, userMessageId)
  const parts = ids.length > 0 ? await realSessionRepo.getPartsByMessageIds(ids) : []
  await realSessionRepo.deleteMessageAndFollowing(sessionId, userMessageId)
  await reconcileCompressionStateAfterTruncate(realSessionRepo, realSnapshotRepo, sessionId)
  await cleanupAttachmentsForParts(attachmentManager, sessionId, parts)
  await sessionManager.flushSessionToDisk(sessionId)
  await touchWorkspaceSession(sessionId)
}

/** 取消 pending：更新 inbox，并删除排队时预落库的孤儿用户消息 */
export async function cancelWorkspacePendingInput(
  inputId: string
): Promise<SessionInputRecord | null> {
  await initDesktopSessionInboxStore()
  const cancelled = getSharedSessionInbox().cancelInput(inputId)
  if (!cancelled) return null

  const userMessageId = cancelled.userMessageId?.trim()
  if (userMessageId) {
    try {
      await deleteWorkspaceQueuedUserMessage(cancelled.sessionId, userMessageId)
    } catch (error) {
      logger.warn(
        `[WorkspaceChat] cancel pending failed to delete orphan user message session=${cancelled.sessionId} userMessage=${userMessageId}:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }
  return cancelled
}
