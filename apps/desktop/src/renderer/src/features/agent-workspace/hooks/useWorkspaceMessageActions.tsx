import { useCallback, useRef } from 'react'
import { useDialog, toast } from '@baishou/ui'
import type { PromptFileRef, WorkspaceRollbackPreview, WorkspaceRollbackScope } from '@baishou/shared'
import { WorkspaceRollbackPreviewBody } from '../components/WorkspaceRollbackPreviewBody'
import {
  buildWorkspaceRollbackPreviewCopy,
  formatWorkspaceRollbackSummary
} from '../utils/workspace-rollback.util'
import {
  getWorkspaceUserFileRefs,
  getWorkspaceUserSkillRefs,
  getWorkspaceUserText
} from '../utils/workspace-message-display.util'
import { mergeWorkspaceFileRefsIntoAttachments } from '../utils/workspace-file-ref-send.util'
import type { WorkspaceChatMessage } from './useWorkspaceChatMessages'
import {
  readSkipEditResendConfirm,
  writeSkipEditResendConfirm
} from '../utils/workspace-edit-resend-skip.util'
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
      fileRefs?: PromptFileRef[]
      attachments?: unknown[]
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

  const renderPreviewBody = useCallback(
    (intro: string, copy: ReturnType<typeof buildWorkspaceRollbackPreviewCopy> | null) => (
      <WorkspaceRollbackPreviewBody intro={intro} copy={copy} />
    ),
    []
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
      copyKeys: { title: string; intro: string },
      options?: { rememberSkip?: boolean }
    ): Promise<WorkspaceRollbackScope | null> => {
      if (options?.rememberSkip) {
        const skipped = readSkipEditResendConfirm()
        if (skipped) return skipped
      }

      const preview = previewRollback
        ? await previewRollback(targetSessionId, userMessageId).catch((error) => {
            console.warn('[useWorkspaceMessageActions] rollback preview failed:', error)
            return null
          })
        : null
      const copy = preview ? buildWorkspaceRollbackPreviewCopy(preview, t) : null
      const body = renderPreviewBody(copyKeys.intro, copy)
      const dontAskAgainLabel = t('workspace_edit_resend.dont_ask_again', '不再提示')
      const scopeChoices = [
        {
          label: t('round_rollback.scope_attributed', '只撤回助手改过的文件'),
          description: t(
            'round_rollback.scope_attributed_desc',
            '你自己改过的文件、命令产生的文件会保留。'
          ),
          value: 'attributed'
        },
        {
          label: t('round_rollback.scope_all', '把这段时间的文件变化全部撤回'),
          description: t(
            'round_rollback.scope_all_desc',
            '包括上面列出的、不是助手直接改的那些文件。'
          ),
          value: 'all',
          destructive: true
        }
      ]

      if (copy?.needsScopeChoice) {
        if (options?.rememberSkip) {
          const choice = await dialog.chooseWithDontAskAgain(
            copyKeys.title,
            scopeChoices,
            body,
            dontAskAgainLabel
          )
          if (!choice || (choice.value !== 'all' && choice.value !== 'attributed')) return null
          if (choice.dontAskAgain) writeSkipEditResendConfirm(choice.value)
          return choice.value
        }
        const choice = await dialog.choose(copyKeys.title, scopeChoices, body)
        return choice === 'all' || choice === 'attributed' ? choice : null
      }

      if (options?.rememberSkip) {
        const result = await dialog.confirmWithDontAskAgain(
          body,
          copyKeys.title,
          dontAskAgainLabel
        )
        if (!result.confirmed) return null
        if (result.dontAskAgain) writeSkipEditResendConfirm('attributed')
        return 'attributed'
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
      meta?: { skillRefs?: SkillRef[]; fileRefs?: PromptFileRef[]; displayText?: string }
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
      const fileRefs =
        meta?.fileRefs ?? (sourceMsg ? getWorkspaceUserFileRefs(sourceMsg) : undefined)
      // 展示用明文；LLM 正文经 skillRefs / fileRefs 重建（勿只发 plain）
      const displayText = trimmedPlain
      const modelText = buildWorkspaceEditResendModelText(trimmedPlain, skillRefs, fileRefs)

      // 确认前加锁；取消确认时 finally 清锁
      busyRef.current = true
      let resendScope: WorkspaceRollbackScope = 'attributed'
      try {
        const outcome = await runWorkspaceEditResendPipeline({
          confirm: async () => {
            const scope = await confirmRollbackScope(
              sessionId,
              userMessageId,
              {
                title: t('workspace_edit_resend.confirm_title', '用编辑后的内容重新发送？'),
                intro: t(
                  'workspace_edit_resend.confirm_desc',
                  '会先撤回这一轮及之后的对话，再用你改过的内容重新发送。文件怎么处理，请选下面一项。此操作不可撤销。'
                )
              },
              { rememberSkip: true }
            )
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
              skillRefs,
              fileRefs,
              attachments: mergeWorkspaceFileRefsIntoAttachments({
                fileRefs,
                folderRoot: folder
              })
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
