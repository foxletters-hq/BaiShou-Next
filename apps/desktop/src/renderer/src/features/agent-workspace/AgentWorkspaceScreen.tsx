import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  InputBar,
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
import { WorkspaceIconRail } from './components/WorkspaceIconRail'
import { WorkspaceSessionPanel } from './components/WorkspaceSessionPanel'
import { AgentWorkspaceChatBar } from './components/AgentWorkspaceChatBar'
import { WorkspaceChangesPanel } from './components/WorkspaceChangesPanel'
import { AgentWorkspaceMessageList } from './components/AgentWorkspaceMessageList'
import { useWorkspaceAgentStream } from './hooks/useWorkspaceAgentStream'
import { useWorkspaceChatMessages } from './hooks/useWorkspaceChatMessages'
import { useWorkspaceRuntimeRefresh } from './hooks/useWorkspaceRuntimeRefresh'
import { formatWorkspaceRollbackSummary } from './utils/workspace-rollback.util'
import { useWorkspaceSessions } from './hooks/useWorkspaceSessions'
import { useAgentWorkspaces } from './hooks/useAgentWorkspaces'
import { useAgentWorkspaceChrome } from './hooks/useAgentWorkspaceChrome'
import { useStreamError } from '../agent/hooks/useStreamError'
import { workspaceEntryMatchesFolder } from './utils/workspace-display.util'
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
  const { sessions, loading: loadingSessions } = useWorkspaceSessions()
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
  const [rightCollapsed, setRightCollapsed] = useState(true)
  const [changes, setChanges] = useState<WorkspaceChangeEntry[]>([])
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null)
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
      ? workspaces.find((entry) => workspaceEntryMatchesFolder(entry, folderRoot)) ?? null
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
    setSelectedChangeId((prev) => {
      if (prev && nextChanges.some((c) => c.id === prev)) return prev
      return nextChanges[0]?.id ?? null
    })
  }, [])

  const handleRuntimeRefresh = useCallback(() => {
    setSelectedChangeId(null)
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
      setSelectedChangeId(null)
    }
  }, [sessionId])

  const handleSelectWorkspace = useCallback(
    async (workspaceId: string) => {
      await selectWorkspace(workspaceId)
      const workspace = workspaces.find((entry) => entry.id === workspaceId)
      if (workspace) {
        setFolderRoot(workspace.folderRoot)
        setSelectedChangeId(null)
        navigate('/agent-workspace')
      }
    },
    [navigate, selectWorkspace, setFolderRoot, workspaces]
  )

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

  const handleChangeAvatar = useCallback(
    async (workspaceId: string) => {
      await updateWorkspaceAvatar(workspaceId)
    },
    [updateWorkspaceAvatar]
  )

  const handleNewSession = useCallback(() => {
    if (!activeFolderRoot) return
    setSelectedChangeId(null)
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
      setSelectedChangeId(null)
      navigate(`/agent-workspace/${targetSessionId}`)
    },
    [navigate, sessionId, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleDeleteSession = useCallback(
    async (targetSessionId: string) => {
      const confirmed = await dialog.confirm(
        t('agent_workspace.delete_session_confirm', '确定删除此工作区会话？相关对话记录也会被移除。'),
        t('agent_workspace.delete_session', '删除会话')
      )
      if (!confirmed) return

      try {
        await window.api.agentWorkspace.deleteSession(targetSessionId)
        notifyWorkspaceSessionsChanged()
        if (targetSessionId === sessionId) {
          setSelectedChangeId(null)
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

        await stream.runWorkspaceChatStream(
          prepared.sessionId,
          trimmed,
          prepared.userMessageId,
          {
            providerId: chrome.model.currentProviderId,
            modelId: chrome.model.currentModelId
          }
        )
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
          <p>{t('round_rollback.confirm_desc', '将恢复本轮对话开始前的文件状态，此操作不可撤销。')}</p>
        </div>,
        t('round_rollback.confirm_title', '回滚本轮变更？')
      )
      if (!confirmed) return

      try {
        setSelectedChangeId(null)
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

  return (
    <div className={styles.screen}>
      <WorkspaceIconRail
        workspaces={workspaces}
        activeWorkspaceId={resolvedActiveWorkspace?.id}
        onSelectWorkspace={(id) => void handleSelectWorkspace(id)}
        onAddWorkspace={() => void handleAddWorkspace()}
        onChangeAvatar={(id) => void handleChangeAvatar(id)}
      />

      {resolvedActiveWorkspace ? (
        <WorkspaceSessionPanel
          workspace={resolvedActiveWorkspace}
          sessions={sessions}
          activeSessionId={sessionId}
          loadingSessions={loadingSessions}
          onNewSession={handleNewSession}
          onSelectSession={(id) => void handleSelectSession(id)}
          onDeleteSession={(id) => void handleDeleteSession(id)}
        />
      ) : null}

      <div className={styles.main}>
        <AgentWorkspaceChatBar
          currentAssistant={
            chrome.currentAssistant
              ? {
                  id: String(chrome.currentAssistant.id),
                  name: chrome.currentAssistant.name,
                  avatarPath: chrome.currentAssistant.avatarPath
                }
              : undefined
          }
          currentProviderId={chrome.model.currentProviderId}
          currentModelId={chrome.model.currentModelId}
          providers={chrome.providers}
          inputTokens={chrome.tokens.totalInputTokens}
          outputTokens={chrome.tokens.totalOutputTokens}
          costMicros={chrome.tokens.estimatedCost * 1_000_000}
          onAssistantClick={() => chrome.setShowAssistantPicker(true)}
          onModelClick={() => chrome.setShowModelSwitcher(true)}
          onCostClick={() => chrome.setShowCostDialog(true)}
          changesPanelCollapsed={rightCollapsed}
          onToggleChangesPanel={() => setRightCollapsed((v) => !v)}
        />

        <div className={styles.chatStage}>
          {!hasWorkspace ? (
            <div className={styles.emptyState}>
              <button
                type="button"
                className={styles.addWorkspaceBtn}
                onClick={() => void handleAddWorkspace()}
              >
                <span className={styles.addWorkspaceBtnIcon} aria-hidden>
                  +
                </span>
                {t('agent_workspace.add_workspace', '添加工作区')}
              </button>
            </div>
          ) : !sessionId || sessionId === 'new-session' ? (
            <div className={styles.emptyState}>
              <p>
                {t(
                  'agent_workspace.select_session_hint',
                  '选择左侧会话，或在下方输入开始新对话。'
                )}
              </p>
            </div>
          ) : (
            <AgentWorkspaceMessageList
              sessionId={sessionId}
              messages={chat.messages}
              pendingAssistantMsg={chat.pendingAssistantMsg}
              streamingText={stream.text}
              streamingReasoning={stream.reasoning}
              isStreaming={stream.isStreaming}
              streamError={stream.error}
              activeToolName={stream.activeTool?.name ?? null}
              completedTools={stream.completedTools}
              failedTools={stream.failedTools}
              assistantProfile={
                chrome.currentAssistant
                  ? {
                      name: chrome.currentAssistant.name,
                      avatarPath: chrome.currentAssistant.avatarPath,
                      emoji: chrome.currentAssistant.emoji
                    }
                  : undefined
              }
              onRollbackRound={handleRollback}
              onChangesUpdate={handleChangesUpdate}
            />
          )}
        </div>

        {hasWorkspace ? (
          <div className={styles.inputArea}>
            {!hasConfiguredModel ? (
              <p className={styles.noModelHint} role="status">
                {t(
                  'agent_workspace.no_model_send_hint',
                  '请先在顶部选择一个对话模型，然后才能发送消息。'
                )}
              </p>
            ) : null}
            <div
              className={!hasConfiguredModel ? styles.inputBlocked : undefined}
              aria-disabled={!hasConfiguredModel}
            >
              <InputBar
                isLoading={stream.isStreaming}
                onSend={(text) => void handleSend(text)}
                onStop={stream.stopChat}
                assistantName={chrome.currentAssistant?.name || t('agent.partner_label', '伙伴')}
                onAssistantTap={() => chrome.setShowAssistantPicker(true)}
              />
            </div>
          </div>
        ) : null}

        <AgentGateDock
          request={stream.pendingAgentGate}
          isReplying={stream.isAgentGateReplying}
          onReply={(payload) => void stream.replyAgentGate(payload)}
        />
      </div>

      <WorkspaceChangesPanel
        changes={changes}
        selectedChangeId={selectedChangeId}
        onSelectChange={setSelectedChangeId}
        collapsed={rightCollapsed}
        onToggleCollapsed={() => setRightCollapsed((v) => !v)}
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
