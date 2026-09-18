import {
  clearPendingAgentStreamStop,
  emitAgentSessionRuntime,
  getSharedSessionInbox,
  reconcileCompressionStateAfterTruncate
} from '@baishou/ai'
import { logger, type SessionInputDelivery, type SessionInputRecord } from '@baishou/shared'
import type { IpcMainInvokeEvent } from 'electron'
import { cleanupAttachmentsForParts } from '@baishou/core-desktop'
import { getAgentManagers } from '../ipc/agent-helpers'
import { touchWorkspaceSession } from './agent-workspace-session.store'
import {
  isWorkspaceSessionStreaming,
  removeActiveWorkspaceStreamSessionId
} from './agent-workspace-tool-context'
import { drainSessionInbox, waitForSessionInboxDrainLock } from './session-inbox-drain'
import { initDesktopSessionInboxStore } from './session-inbox.store'

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

export async function clearWorkspaceSessionPendingInputs(sessionId: string): Promise<void> {
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

export async function drainWorkspaceInbox(
  event: IpcMainInvokeEvent,
  sessionId: string
): Promise<void> {
  const { runWorkspaceStreamChat } = await import('./agent-workspace-chat.service')
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

export async function listWorkspacePendingInputs(sessionId: string): Promise<SessionInputRecord[]> {
  await initDesktopSessionInboxStore()
  return getSharedSessionInbox().listPending(sessionId)
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
