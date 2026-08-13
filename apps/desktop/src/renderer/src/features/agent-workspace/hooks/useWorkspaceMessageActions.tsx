import React, { useCallback, useRef } from 'react'
import { useDialog, toast } from '@baishou/ui'
import type { WorkspaceRollbackPreview, WorkspaceRollbackScope } from '@baishou/shared'
import {
  buildWorkspaceRollbackPreviewCopy,
  formatWorkspaceRollbackSummary,
  type WorkspaceRollbackPreviewCopy
} from '../utils/workspace-rollback.util'
import {
  getWorkspaceUserSkillRefs,
  getWorkspaceUserText
} from '../utils/workspace-message-display.util'
import type { WorkspaceChatMessage } from './useWorkspaceChatMessages'
import {
  buildWorkspaceEditResendModelText,
  runWorkspaceEditResendPipeline
} from './run-workspace-edit-resend.pipeline'

type TranslateFn = (key: string, fallback: string, options?: Record<string, unknown>) => string

type SkillRef = { command: string; content: string }

export interface UseWorkspaceMessageActionsOptions {
  t: TranslateFn
  sessionId: string | undefined
  folderRoot: string | null
  messages: WorkspaceChatMessage[]
  isStreaming: boolean
  currentProviderId: string
  currentModelId: string
  selectedAssistantId?: string
  searchModeEnabled: boolean
  getReasoningEffort: () => string | undefined
  isModelReady: () => boolean
  onModelNotReady: () => void
  stopChat: () => void
  rollbackRound: (
    sessionId: string,
    userMessageId: string,
    scope?: WorkspaceRollbackScope
  ) => Promise<{ restored: string[]; deleted: string[]; skipped: string[] }>
  previewRollback?: (
    sessionId: string,
    userMessageId: string
  ) => Promise<WorkspaceRollbackPreview>
  prepareWorkspaceTurn: (
    sessionId: string | undefined,
    text: string,
    folderRoot: string,
    options?: {
      assistantId?: string
      displayText?: string
      skillRefs?: SkillRef[]
    }
  ) => Promise<{ sessionId: string; userMessageId: string; createdNew: boolean }>
  admitAndStream: (params: {
    sessionId: string
    text: string
    userMessageId: string
    providerId: string
    modelId: string
    reasoningEffort?: string
    searchMode?: boolean
  }) => Promise<void>
  refreshMessages: (sessionId?: string) => Promise<void> | void
  notifySessionsChanged: () => void
  setComposerRefill: (value: {
    text: string
    skillRefs?: SkillRef[]
    nonce: number
  } | null) => void
  onCreatedNewSession?: (sessionId: string) => void
}

/**
 * 工作台消息操作：回滚本轮（回填输入框）与编辑重发（级联回滚后自动开流）。
 * 不复用伙伴 useMessageActions（其 edit-message 不回滚磁盘）。
 */
export function useWorkspaceMessageActions(options: UseWorkspaceMessageActionsOptions) {
  const dialog = useDialog()
  const busyRef = useRef(false)
  const {
    t,
    sessionId,
    folderRoot,
    messages,
    isStreaming,
    currentProviderId,
    currentModelId,
    selectedAssistantId,
    searchModeEnabled,
    getReasoningEffort,
    isModelReady,
    onModelNotReady,
    stopChat,
    rollbackRound,
    previewRollback,
    prepareWorkspaceTurn,
    admitAndStream,
    refreshMessages,
    notifySessionsChanged,
    setComposerRefill,
    onCreatedNewSession
  } = options

  const stopIfNeeded = useCallback(() => {
    if (isStreaming) stopChat()
  }, [isStreaming, stopChat])

  const renderScopeNote = useCallback(
    () => (
      <p style={{ marginTop: 8, opacity: 0.75, fontSize: '0.9em' }}>
        {t('round_rollback.scope_note', '仅覆盖本会话中 AI 写工具触及的路径；不能替代版本控制。')}
      </p>
    ),
    [t]
  )

  const renderPreviewBody = useCallback(
    (intro: string, copy: WorkspaceRollbackPreviewCopy | null) => {
      if (!copy) {
        return (
          <div>
            <p>{intro}</p>
            {renderScopeNote()}
          </div>
        )
      }

      const pathListStyle: React.CSSProperties = {
        margin: '4px 0 0',
        paddingLeft: 16,
        maxHeight: 160,
        overflowY: 'auto',
        fontSize: '0.9em',
        opacity: 0.85,
        whiteSpace: 'pre-wrap'
      }

      return (
        <div>
          <p>{intro}</p>
          {copy.cascadeNote ? (
            <p style={{ marginTop: 8, fontSize: '0.9em' }}>{copy.cascadeNote}</p>
          ) : null}
          {copy.isEmpty ? (
            <p style={{ marginTop: 8, opacity: 0.75, fontSize: '0.9em' }}>
              {t('round_rollback.preview_no_files', '本轮没有文件改动，只会删除对话记录。')}
            </p>
          ) : null}
          {copy.fileLines.length > 0 ? <pre style={pathListStyle}>{copy.fileLines.join('\n')}</pre> : null}
          {copy.extraLines.length > 0 ? (
            <pre style={{ ...pathListStyle, marginTop: 8 }}>{copy.extraLines.join('\n')}</pre>
          ) : null}
          {copy.extraLines.length === 0 ? renderScopeNote() : null}
        </div>
      )
    },
    [renderScopeNote, t]
  )

  /**
   * 先算出这次回滚会动哪些文件，再让用户确认。
   * 当存在写工具解释不了的改动时，把「只撤 AI 的」和「全部撤」摆出来让用户选，
   * 而不是替他决定要不要覆盖掉自己的手改。
   */
  const confirmRollbackScope = useCallback(
    async (
      targetSessionId: string,
      userMessageId: string,
      copyKeys: { title: string; intro: string }
    ): Promise<WorkspaceRollbackScope | null> => {
      const preview = previewRollback
        ? await previewRollback(targetSessionId, userMessageId).catch((error) => {
            console.warn('[useWorkspaceMessageActions] rollback preview failed:', error)
            return null
          })
        : null
      const copy = preview ? buildWorkspaceRollbackPreviewCopy(preview, t) : null
      const body = renderPreviewBody(copyKeys.intro, copy)

      if (copy?.needsScopeChoice) {
        const choice = await dialog.choose(
          copyKeys.title,
          [
            {
              label: t('round_rollback.scope_attributed', '只还原 AI 改动的文件'),
              value: 'attributed'
            },
            {
              label: t('round_rollback.scope_all', '全部还原，包括上面这些变化'),
              value: 'all',
              destructive: true
            }
          ],
          body
        )
        return choice === 'all' || choice === 'attributed' ? choice : null
      }

      const confirmed = await dialog.confirm(body, copyKeys.title)
      return confirmed ? 'attributed' : null
    },
    [dialog, previewRollback, renderPreviewBody, t]
  )

  const handleRollback = useCallback(
    async (userMessageId: string) => {
      if (!sessionId || busyRef.current) return

      const scope = await confirmRollbackScope(sessionId, userMessageId, {
        title: t('round_rollback.confirm_title', '回滚本轮变更？'),
        intro: t(
          'round_rollback.confirm_desc',
          '将恢复本轮开始前的文件状态，并删除本轮及之后的对话，此操作不可撤销。'
        )
      })
      if (!scope) return

      const sourceMsg = messages.find((msg) => msg.id === userMessageId)
      const refillText = sourceMsg ? getWorkspaceUserText(sourceMsg).trim() : ''
      const refillSkillRefs = sourceMsg
        ? getWorkspaceUserSkillRefs(sourceMsg) ?? sourceMsg.skillRefs
        : undefined

      busyRef.current = true
      try {
        stopIfNeeded()
        const result = await rollbackRound(sessionId, userMessageId, scope)
        notifySessionsChanged()
        await refreshMessages(sessionId)
        const summary = formatWorkspaceRollbackSummary(result, t)
        toast.showSuccess(summary.headline)
        const dialogBody =
          summary.detailLines.length > 0 ? summary.detailLines.join('\n') : summary.headline
        await dialog.alert(dialogBody, t('round_rollback.action', '回滚本轮'))
        if (refillText || (refillSkillRefs && refillSkillRefs.length > 0)) {
          setComposerRefill({
            text: refillText,
            skillRefs: refillSkillRefs,
            nonce: Date.now()
          })
        }
      } catch (error) {
        console.error('[useWorkspaceMessageActions] rollback failed:', error)
        await dialog.alert(
          t('round_rollback.failed', '回滚失败'),
          t('round_rollback.action', '回滚本轮')
        )
      } finally {
        busyRef.current = false
      }
    },
    [
      confirmRollbackScope,
      dialog,
      messages,
      notifySessionsChanged,
      refreshMessages,
      rollbackRound,
      sessionId,
      setComposerRefill,
      stopIfNeeded,
      t
    ]
  )

  const handleEditResend = useCallback(
    async (
      userMessageId: string,
      newText: string,
      meta?: { skillRefs?: SkillRef[]; displayText?: string }
    ): Promise<boolean> => {
      if (!sessionId || busyRef.current) return false
      const trimmedPlain = newText.trim()
      if (!trimmedPlain) return false

      if (!isModelReady()) {
        onModelNotReady()
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return false
      }

      const folder = folderRoot
      if (!folder) {
        toast.showInfo(t('agent_workspace.need_folder', '请先打开工作区文件夹'))
        return false
      }

      const sourceMsg = messages.find((msg) => msg.id === userMessageId)
      const skillRefs =
        meta?.skillRefs ??
        (sourceMsg ? getWorkspaceUserSkillRefs(sourceMsg) ?? sourceMsg.skillRefs : undefined)
      // 展示用明文；LLM 正文经 skillRefs 重建（勿只发 plain）
      const displayText = trimmedPlain
      const modelText = buildWorkspaceEditResendModelText(trimmedPlain, skillRefs)

      // 确认前加锁；取消确认时 finally 清锁
      busyRef.current = true
      let resendScope: WorkspaceRollbackScope = 'attributed'
      try {
        const outcome = await runWorkspaceEditResendPipeline({
          confirm: async () => {
            const scope = await confirmRollbackScope(sessionId, userMessageId, {
              title: t('workspace_edit_resend.confirm_title', '编辑并重新发送？'),
              intro: t(
                'workspace_edit_resend.confirm_desc',
                '将撤回该轮及之后的文件改动与对话，并用新内容重新发送。此操作不可撤销。'
              )
            })
            if (!scope) return false
            resendScope = scope
            return true
          },
          isStreaming,
          stopChat,
          rollbackRound: () => rollbackRound(sessionId, userMessageId, resendScope),
          afterRollback: async (result) => {
            notifySessionsChanged()
            await refreshMessages(sessionId)
            const summary = formatWorkspaceRollbackSummary(result, t)
            toast.showSuccess(summary.headline)
          },
          prepareWorkspaceTurn: (editedModelText) =>
            prepareWorkspaceTurn(sessionId, editedModelText, folder, {
              assistantId: selectedAssistantId,
              displayText,
              skillRefs
            }),
          admitAndStream,
          modelText,
          providerId: currentProviderId,
          modelId: currentModelId,
          reasoningEffort: getReasoningEffort(),
          searchMode: searchModeEnabled,
          onCreatedNewSession,
          currentSessionId: sessionId
        })
        return outcome === 'completed'
      } catch (error) {
        console.error('[useWorkspaceMessageActions] edit resend failed:', error)
        toast.showError(
          t('workspace_edit_resend.failed', '编辑重发失败，文件可能已回滚，请检查后重试')
        )
        setComposerRefill({
          text: trimmedPlain,
          skillRefs,
          nonce: Date.now()
        })
        return false
      } finally {
        busyRef.current = false
      }
    },
    [
      admitAndStream,
      confirmRollbackScope,
      currentModelId,
      currentProviderId,
      dialog,
      folderRoot,
      getReasoningEffort,
      isModelReady,
      isStreaming,
      messages,
      notifySessionsChanged,
      onCreatedNewSession,
      onModelNotReady,
      prepareWorkspaceTurn,
      refreshMessages,
      rollbackRound,
      searchModeEnabled,
      selectedAssistantId,
      sessionId,
      setComposerRefill,
      stopChat,
      t
    ]
  )

  return {
    handleRollback,
    handleEditResend
  }
}
