import {
  clearPendingAgentStreamStop,
  reconcileCompressionStateAfterTruncate,
  runCascadeThenTruncateSteps
} from '@baishou/ai'
import {
  logger,
  type AgentRoundCheckpoint,
  type WorkspaceRollbackPreview,
  type WorkspaceRollbackScope
} from '@baishou/shared'
import { cleanupAttachmentsForParts } from '@baishou/core-desktop'
import { AgentChatService } from '../ipc/AgentChatService'
import { getAgentManagers } from '../ipc/agent-helpers'
import {
  getWorkspaceCheckpointForUserMessage,
  getWorkspaceSessionBinding,
  loadSessionCheckpointsIntoService,
  removeWorkspaceCheckpointsForUserMessages,
  removeWorkspaceSession,
  saveWorkspaceCheckpoint,
  touchWorkspaceSession
} from './agent-workspace-session.store'
import { cleanupUnusedWorkspaceShadowGit } from './workspace-shadow-git.provider'
import { collectExtraRollbackPaths } from './workspace-chat-git.util'
import { checkpointService, waitForWorkspaceSessionStreamIdle } from './workspace-chat-runtime'
import { clearWorkspaceSessionPendingInputs } from './workspace-chat-inbox'

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
  const extraPaths = collectExtraRollbackPaths(attributed, changed, diffAvailable)

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
