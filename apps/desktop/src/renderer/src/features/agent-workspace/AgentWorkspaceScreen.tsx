import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AgentGateDock,
  useDialog,
  AssistantPickerSheet,
  ChatCostDialog,
  ModelSwitcherPopup,
  toast
} from '@baishou/ui'
import {
  isEmbeddingModel,
  isTtsModel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  formatDialogueModelLabel,
  type WorkspaceChangeEntry
} from '@baishou/shared'
import { useWorkspaceAgentStream } from './hooks/useWorkspaceAgentStream'
import { useWorkspaceChatMessages } from './hooks/useWorkspaceChatMessages'
import { useWorkspaceRuntimeRefresh } from './hooks/useWorkspaceRuntimeRefresh'
import { formatWorkspaceRollbackSummary } from './utils/workspace-rollback.util'
import { useWorkspaceSessions } from './hooks/useWorkspaceSessions'
import { useAgentWorkspaces } from './hooks/useAgentWorkspaces'
import { useAgentWorkspaceChrome } from './hooks/useAgentWorkspaceChrome'
import { useStreamError } from '../agent/hooks/useStreamError'
import { workspaceEntryMatchesFolder } from './utils/workspace-display.util'
import { WorkbenchShell } from './workbench/WorkbenchShell'
import styles from './AgentWorkspaceScreen.module.css'

interface WorkspaceOutletContext {
  folderRoot: string | null
  setFolderRoot: (path: string | null) => void
}

function notifyWorkspaceSessionsChanged(): void {
  window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
}

export const AgentWorkspaceScreen: React.FC = () => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { folderRoot, setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const {
    workspaces,
    activeWorkspace,
    selectWorkspace,
    addWorkspaceFromPicker,
    registerWorkspaceFolder,
    updateWorkspaceAvatar,
    loading: loadingWorkspaces
  } = useAgentWorkspaces()
  const chrome = useAgentWorkspaceChrome(sessionId)
  const { sessions, loading: loadingSessions } = useWorkspaceSessions()
  const [changes, setChanges] = useState<WorkspaceChangeEntry[]>([])
  const syncedFolderKeysRef = useRef(new Set<string>())

  const stream = useWorkspaceAgentStream(sessionId)
  const chat = useWorkspaceChatMessages({
    sessionId,
    isStreaming: stream.isStreaming,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning
  })
  useStreamError(stream.error, stream.isStreaming)
  const resolvedActiveWorkspace =
    activeWorkspace ??
    (folderRoot
      ? (workspaces.find((entry) => workspaceEntryMatchesFolder(entry, folderRoot)) ?? null)
      : null)
  const activeFolderRoot = resolvedActiveWorkspace?.folderRoot ?? folderRoot
  const hasWorkspace = Boolean(activeFolderRoot)

  useEffect(() => {
    if (resolvedActiveWorkspace?.folderRoot) {
      setFolderRoot(resolvedActiveWorkspace.folderRoot)
    }
  }, [resolvedActiveWorkspace?.folderRoot, setFolderRoot])

  useEffect(() => {
    if (loadingWorkspaces || !folderRoot) return
    const key = folderRoot.replace(/\\/g, '/').toLowerCase()
    if (workspaces.some((entry) => workspaceEntryMatchesFolder(entry, folderRoot))) {
      syncedFolderKeysRef.current.add(key)
      return
    }
    if (syncedFolderKeysRef.current.has(key)) return
    syncedFolderKeysRef.current.add(key)
    void registerWorkspaceFolder(folderRoot).catch((error) => {
      syncedFolderKeysRef.current.delete(key)
      console.error('[AgentWorkspaceScreen] sync folder to registry failed:', error)
    })
  }, [folderRoot, loadingWorkspaces, registerWorkspaceFolder, workspaces])

  useEffect(() => {
    if (!sessionId || !folderRoot || !workspaces.length) return
    const match = workspaces.find((entry) => workspaceEntryMatchesFolder(entry, folderRoot))
    if (match && match.id !== resolvedActiveWorkspace?.id) {
      void selectWorkspace(match.id)
    }
  }, [sessionId, folderRoot, workspaces, resolvedActiveWorkspace?.id, selectWorkspace])

  const handleChangesUpdate = useCallback((nextChanges: WorkspaceChangeEntry[]) => {
    setChanges(nextChanges)
  }, [])

  const handleRuntimeRefresh = useCallback(() => {
    void chat.refresh()
  }, [chat])

  useWorkspaceRuntimeRefresh(sessionId, handleRuntimeRefresh)

  const hasConfiguredModel = useMemo(
    () =>
      isConfiguredProviderId(chrome.model.currentProviderId) &&
      isConfiguredDialogueModelId(chrome.model.currentModelId),
    [chrome.model.currentModelId, chrome.model.currentProviderId]
  )

  useEffect(() => {
    if (!sessionId || sessionId === 'new-session') {
      setChanges([])
    }
  }, [sessionId])

  const handleAddWorkspace = useCallback(async () => {
    try {
      const entry = await addWorkspaceFromPicker()
      if (entry) {
        setFolderRoot(entry.folderRoot)
      }
    } catch (error) {
      console.error('[AgentWorkspaceScreen] add workspace failed:', error)
      await dialog.alert(
        error instanceof Error
          ? error.message
          : t('agent_workspace.add_workspace_failed', '添加工作区失败，请重启应用后重试'),
        t('agent_workspace.add_workspace', '添加工作区')
      )
    }
  }, [addWorkspaceFromPicker, dialog, setFolderRoot, t])

  const handleSelectWorkspace = useCallback(
    async (workspaceId: string) => {
      if (workspaceId === resolvedActiveWorkspace?.id) return
      const target = workspaces.find((entry) => entry.id === workspaceId)
      if (!target) return
      await selectWorkspace(workspaceId)
      setFolderRoot(target.folderRoot)
      if (sessionId) {
        navigate('/agent-workspace')
      }
    },
    [navigate, resolvedActiveWorkspace?.id, selectWorkspace, sessionId, setFolderRoot, workspaces]
  )

  const handleChangeWorkspaceAvatar = useCallback(
    (workspaceId: string) => {
      void updateWorkspaceAvatar(workspaceId)
    },
    [updateWorkspaceAvatar]
  )

  const handleNewSession = useCallback(() => {
    if (!activeFolderRoot) return
    navigate('/agent-workspace')
  }, [activeFolderRoot, navigate])

  const handleSelectSession = useCallback(
    async (targetSessionId: string) => {
      if (targetSessionId === sessionId) return
      try {
        const binding = await window.api.agentWorkspace.getBinding(targetSessionId)
        if (binding?.folderRoot) {
          setFolderRoot(binding.folderRoot)
          const workspace = workspaces.find((entry) =>
            workspaceEntryMatchesFolder(entry, binding.folderRoot)
          )
          if (workspace) {
            await selectWorkspace(workspace.id)
          }
        }
      } catch {
        /* ignore */
      }
      navigate(`/agent-workspace/${targetSessionId}`)
    },
    [navigate, sessionId, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleDeleteSession = useCallback(
    async (targetSessionId: string) => {
      const confirmed = await dialog.confirm(
        t(
          'agent_workspace.delete_session_confirm',
          '确定删除此工作区会话？相关对话记录也会被移除。'
        ),
        t('agent_workspace.delete_session', '删除会话')
      )
      if (!confirmed) return

      try {
        await window.api.agentWorkspace.deleteSession(targetSessionId)
        notifyWorkspaceSessionsChanged()
        if (targetSessionId === sessionId) {
          navigate('/agent-workspace')
        }
      } catch (error) {
        console.error('[AgentWorkspaceScreen] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, navigate, sessionId, t]
  )

  const handleRenameSession = useCallback(
    async (targetSessionId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return

      try {
        await window.electron.ipcRenderer.invoke(
          'agent:update-session-title',
          targetSessionId,
          trimmed
        )
        notifyWorkspaceSessionsChanged()
      } catch (error) {
        console.error('[AgentWorkspaceScreen] rename session failed:', error)
        await dialog.alert(t('common.error', '操作失败'), t('workbench.rename_session', '重命名'))
      }
    },
    [dialog, t]
  )

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || stream.isStreaming) return

      if (
        !isConfiguredProviderId(chrome.model.currentProviderId) ||
        !isConfiguredDialogueModelId(chrome.model.currentModelId)
      ) {
        chrome.setShowModelSwitcher(true)
        toast.showInfo(t('agent.error.no_model', '请先在顶部选择一个模型'))
        return
      }

      let folder = activeFolderRoot
      if (!folder) {
        const entry = await addWorkspaceFromPicker()
        if (!entry) return
        folder = entry.folderRoot
        setFolderRoot(folder)
      }

      try {
        const prepared = await stream.prepareWorkspaceTurn(sessionId, trimmed, folder, {
          assistantId: chrome.selectedAssistantId
        })

        if (prepared.createdNew && prepared.sessionId !== sessionId) {
          navigate(`/agent-workspace/${prepared.sessionId}`)
        }

        void chat.refresh(prepared.sessionId)
        chat.setStreamSessionId(prepared.sessionId)

        await stream.runWorkspaceChatStream(prepared.sessionId, trimmed, prepared.userMessageId, {
          providerId: chrome.model.currentProviderId,
          modelId: chrome.model.currentModelId
        })
        notifyWorkspaceSessionsChanged()
      } catch (error) {
        console.error('[AgentWorkspaceScreen] send failed:', error)
      }
    },
    [
      activeFolderRoot,
      addWorkspaceFromPicker,
      chrome.model.currentModelId,
      chrome.model.currentProviderId,
      chrome.setShowModelSwitcher,
      chrome.selectedAssistantId,
      chat,
      navigate,
      sessionId,
      setFolderRoot,
      stream,
      t
    ]
  )

  const handleRollback = useCallback(
    async (userMessageId: string) => {
      if (!sessionId) return

      const confirmed = await dialog.confirm(
        <div>
          <p>
            {t('round_rollback.confirm_desc', '将恢复本轮对话开始前的文件状态，此操作不可撤销。')}
          </p>
        </div>,
        t('round_rollback.confirm_title', '回滚本轮变更？')
      )
      if (!confirmed) return

      try {
        const result = await stream.rollbackRound(sessionId, userMessageId)
        notifyWorkspaceSessionsChanged()
        await chat.refresh()
        const summary = formatWorkspaceRollbackSummary(result, t)
        toast.showSuccess(summary.headline)
        const dialogBody =
          summary.detailLines.length > 0 ? summary.detailLines.join('\n') : summary.headline
        await dialog.alert(dialogBody, t('round_rollback.action', '回滚本轮'))
      } catch (error) {
        console.error('[AgentWorkspaceScreen] rollback failed:', error)
        await dialog.alert(
          t('round_rollback.failed', '回滚失败'),
          t('round_rollback.action', '回滚本轮')
        )
      }
    },
    [chat, dialog, sessionId, stream, t]
  )

  const layoutScopeKey = resolvedActiveWorkspace?.id ?? activeFolderRoot

  return (
    <div className={styles.screen}>
      <WorkbenchShell
        folderRoot={activeFolderRoot}
        layoutScopeKey={layoutScopeKey}
        workspace={resolvedActiveWorkspace}
        workspaces={workspaces}
        activeWorkspaceId={resolvedActiveWorkspace?.id}
        sessions={sessions}
        loadingSessions={loadingSessions}
        activeSessionId={sessionId}
        changes={changes}
        onOpenFolder={() => void handleAddWorkspace()}
        onSelectWorkspace={(id) => void handleSelectWorkspace(id)}
        onChangeWorkspaceAvatar={handleChangeWorkspaceAvatar}
        onNewSession={handleNewSession}
        onSelectSession={(id) => void handleSelectSession(id)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        onRenameSession={(id, title) => void handleRenameSession(id, title)}
        agentPanel={{
          hasWorkspace,
          hasConfiguredModel,
          sessionId,
          chrome: {
            currentAssistant: chrome.currentAssistant
              ? {
                  id: String(chrome.currentAssistant.id),
                  name: chrome.currentAssistant.name,
                  avatarPath: chrome.currentAssistant.avatarPath
                }
              : undefined,
            currentProviderId: chrome.model.currentProviderId,
            currentModelId: chrome.model.currentModelId,
            providers: chrome.providers,
            totalInputTokens: chrome.tokens.totalInputTokens,
            totalOutputTokens: chrome.tokens.totalOutputTokens,
            estimatedCost: chrome.tokens.estimatedCost,
            onAssistantClick: () => chrome.setShowAssistantPicker(true),
            onModelClick: () => chrome.setShowModelSwitcher(true),
            onCostClick: () => chrome.setShowCostDialog(true)
          },
          chat: {
            messages: chat.messages,
            pendingAssistantMsg: chat.pendingAssistantMsg
          },
          stream: {
            text: stream.text,
            reasoning: stream.reasoning,
            isStreaming: stream.isStreaming,
            error: stream.error,
            activeToolName: stream.activeTool?.name ?? null,
            completedTools: stream.completedTools,
            failedTools: stream.failedTools,
            stopChat: stream.stopChat
          },
          assistantProfile: chrome.currentAssistant
            ? {
                name: chrome.currentAssistant.name,
                avatarPath: chrome.currentAssistant.avatarPath,
                emoji: chrome.currentAssistant.emoji
              }
            : undefined,
          onSend: (text) => void handleSend(text),
          onRollbackRound: (id) => void handleRollback(id),
          onChangesUpdate: handleChangesUpdate,
          onAssistantTap: () => chrome.setShowAssistantPicker(true),
          assistantName: chrome.currentAssistant?.name || t('agent.partner_label', '伙伴')
        }}
      />

      <AgentGateDock
        request={stream.pendingAgentGate}
        isReplying={stream.isAgentGateReplying}
        onReply={(payload) => void stream.replyAgentGate(payload)}
      />

      <ChatCostDialog
        isOpen={chrome.showCostDialog}
        onClose={() => chrome.setShowCostDialog(false)}
        details={{
          modelName:
            formatDialogueModelLabel(chrome.model.currentModelId) ??
            t('agent.no_model_selected', '暂未选择模型'),
          promptTokens: chrome.tokens.totalInputTokens,
          completionTokens: chrome.tokens.totalOutputTokens,
          cacheReadTokens: chrome.tokens.totalCacheReadInputTokens,
          cacheWriteTokens: chrome.tokens.totalCacheWriteInputTokens,
          totalTokens: chrome.tokens.totalInputTokens + chrome.tokens.totalOutputTokens,
          estimatedCost: `$${chrome.tokens.estimatedCost.toFixed(6)}`
        }}
        pricingLastUpdated={chrome.pricingLastUpdated}
        onRefreshPricing={chrome.handleRefreshPricing}
      />

      {chrome.showModelSwitcher ? (
        <ModelSwitcherPopup
          onClose={() => chrome.setShowModelSwitcher(false)}
          providers={chrome.providers
            .map((p) => {
              const modelList =
                p.enabledModels && p.enabledModels.length > 0 ? p.enabledModels : p.models || []
              const filteredModels = modelList.filter((m) => !isEmbeddingModel(m) && !isTtsModel(m))
              return {
                id: p.id,
                name: p.name || p.id,
                type: p.type || 'custom',
                models: p.models || [],
                enabledModels: filteredModels
              }
            })
            .filter((p) => p.enabledModels.length > 0)}
          currentProviderId={chrome.model.currentProviderId}
          currentModelId={chrome.model.currentModelId}
          onSelect={(providerId, modelId) => {
            chrome.model.userManuallySetModelRef.current = true
            chrome.model.setCurrentProviderId(providerId)
            chrome.model.setCurrentModelId(modelId)
            chrome.setShowModelSwitcher(false)
          }}
        />
      ) : null}

      <AssistantPickerSheet
        isOpen={chrome.showAssistantPicker}
        assistants={chrome.assistants.map((a) => ({
          ...a,
          id: String(a.id),
          emoji: a.emoji || '✨',
          systemPrompt: a.systemPrompt || '',
          compressSystemPrompt: a.compressSystemPrompt ?? null
        }))}
        currentAssistantId={chrome.selectedAssistantId}
        onSelect={(assistant) => chrome.handleAssistantSelected(assistant)}
        onClose={() => chrome.setShowAssistantPicker(false)}
        onRefreshAssistants={() => chrome.fetchAssistants()}
        pinnedIds={new Set(chrome.pinnedIds)}
        onTogglePin={async (id, isPinned) => {
          if (window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned)
            await chrome.fetchAssistants()
          }
        }}
        onCreateNew={() => chrome.setShowAssistantPicker(false)}
      />
    </div>
  )
}
