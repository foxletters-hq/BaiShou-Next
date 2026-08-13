import { buildWorkspaceModelText } from '../utils/workspace-message-display.util'
import type { WorkspaceRollbackResult } from '../utils/workspace-rollback.util'

export type WorkspaceEditResendSkillRef = { command: string; content: string }

export type WorkspaceEditResendPrepareResult = {
  sessionId: string
  userMessageId: string
  createdNew: boolean
}

/** 与 InputBar / 工作台发送一致：skill 正文 + 用户 plain */
export function buildWorkspaceEditResendModelText(
  plain: string,
  skillRefs?: WorkspaceEditResendSkillRef[]
): string {
  return buildWorkspaceModelText(plain, skillRefs)
}

export type WorkspaceEditResendPipelineDeps = {
  confirm: () => Promise<boolean>
  isStreaming: boolean
  stopChat: () => void
  rollbackRound: () => Promise<WorkspaceRollbackResult>
  /** 回滚后副作用（刷新列表、toast 等）；不计入 prepare/admit 顺序断言 */
  afterRollback?: (result: WorkspaceRollbackResult) => Promise<void> | void
  prepareWorkspaceTurn: (modelText: string) => Promise<WorkspaceEditResendPrepareResult>
  admitAndStream: (params: {
    sessionId: string
    text: string
    userMessageId: string
    providerId: string
    modelId: string
    reasoningEffort?: string
    searchMode?: boolean
  }) => Promise<void>
  modelText: string
  providerId: string
  modelId: string
  reasoningEffort?: string
  searchMode?: boolean
  onCreatedNewSession?: (sessionId: string) => void
  /** 当前会话 id；prepare 若创建了新会话则回调 */
  currentSessionId: string
}

/**
 * 工作台编辑重发核心流水线（纯异步、可单测）：
 * confirm →（若 streaming）stop → rollback → prepare(edited model text) → admit(provider/model)
 */
export async function runWorkspaceEditResendPipeline(
  deps: WorkspaceEditResendPipelineDeps
): Promise<'cancelled' | 'completed'> {
  const confirmed = await deps.confirm()
  if (!confirmed) return 'cancelled'

  if (deps.isStreaming) {
    deps.stopChat()
  }

  const rollbackResult = await deps.rollbackRound()
  await deps.afterRollback?.(rollbackResult)

  const prepared = await deps.prepareWorkspaceTurn(deps.modelText)

  if (prepared.createdNew && prepared.sessionId !== deps.currentSessionId) {
    deps.onCreatedNewSession?.(prepared.sessionId)
  }

  await deps.admitAndStream({
    sessionId: prepared.sessionId,
    text: deps.modelText,
    userMessageId: prepared.userMessageId,
    providerId: deps.providerId,
    modelId: deps.modelId,
    reasoningEffort: deps.reasoningEffort,
    searchMode: deps.searchMode
  })

  return 'completed'
}
