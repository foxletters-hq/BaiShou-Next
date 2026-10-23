import {
  AgentRoundCheckpointService,
  createNodeWorkspaceFs,
  waitForStreamIdleThenForceClear
} from '@baishou/ai'
import { logger } from '@baishou/shared'
import { saveWorkspaceCheckpoint } from './agent-workspace-session.store'
import {
  isWorkspaceSessionStreaming,
  removeActiveWorkspaceStreamSessionId
} from './agent-workspace-tool-context'
import { getWorkspaceSnapshotStore } from './workspace-shadow-git.provider'

export const checkpointService = new AgentRoundCheckpointService(
  createNodeWorkspaceFs(),
  getWorkspaceSnapshotStore()
)

const STREAM_IDLE_POLL_MS = 50
const STREAM_IDLE_MAX_WAIT_MS = 2000

/**
 * 轮次收尾：再拍一张快照并落盘。
 *
 * 收尾快照与开始那张做 diff，就能看出本轮到底改了什么——包括终端命令这类
 * 不经过写工具、因而没有归因记录的改动。快照失败只影响回滚能力，不该打断对话。
 */
export async function finalizeRoundCheckpoint(
  checkpointId: string,
  folderRoot: string
): Promise<void> {
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

export async function waitForWorkspaceSessionStreamIdle(sessionId: string): Promise<void> {
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

export function getWorkspaceCheckpointService(): AgentRoundCheckpointService {
  return checkpointService
}
