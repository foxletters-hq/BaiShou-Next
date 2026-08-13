/* eslint-disable max-lines -- workbench screen orchestrates chrome/stream/gate/session */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  AgentGateDock,
  useDialog,
  AssistantPickerSheet,
  ChatCostDialog,
  SessionModelMenu,
  toast
} from '@baishou/ui'
import {
  isEmbeddingModel,
  isTtsModel,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  formatDialogueModelLabel,
  getReasoningControlForModel,
  normalizeReasoningEffortSetting,
  type ReasoningEffortSetting,
  type WorkspaceChangeEntry
} from '@baishou/shared'
import {
  selectQueuePosition,
  selectSameActionCountInSession,
  useAgentGateInboxStore,
  useAgentStore
} from '@baishou/store'
import { useWorkspaceAgentStream } from './hooks/useWorkspaceAgentStream'
import { useWorkspaceChatMessages } from './hooks/useWorkspaceChatMessages'
import { useWorkspaceMessageActions } from './hooks/useWorkspaceMessageActions'
import { useWorkspaceRuntimeRefresh } from './hooks/useWorkspaceRuntimeRefresh'
import { useWorkspaceSessions } from './hooks/useWorkspaceSessions'
import { useAgentWorkspaces } from './hooks/useAgentWorkspaces'
import { useAgentWorkspaceChrome } from './hooks/useAgentWorkspaceChrome'
import { useWorkspaceInitMessage } from './hooks/useWorkspaceInitMessage'
import { useStreamError } from '../agent/hooks/useStreamError'
import { clearStreamBridgeForSession } from '../agent/hooks/agent-stream-session-store'
import {
  getReasoningEffortForModel,
  getSessionReasoningEffortOverride,
  setReasoningEffortForModel,
  setSessionReasoningEffortOverride
} from '../agent/reasoning-effort-session'
import {
  buildModelReasoningPreviewMap,
  formatReasoningControlPreview
} from '../agent/format-reasoning-control-preview'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
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
  const { sessionId, workspaceId: routeWorkspaceId } = useParams<{
    sessionId?: string
    workspaceId?: string
  }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { folderRoot, setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const {
    workspaces,
    activeWorkspace,
    selectWorkspace,
    addWorkspaceFromPicker,
    registerWorkspaceFolder,
    loading: loadingWorkspaces
  } = useAgentWorkspaces()
  const [boundStreamSessionId, setBoundStreamSessionId] = useState<string | undefined>()
  const streamBindId =
    sessionId && sessionId !== 'new-session' ? sessionId : boundStreamSessionId
  const chrome = useAgentWorkspaceChrome(streamBindId ?? sessionId)
  const { sessions, loading: loadingSessions } = useWorkspaceSessions()
  const [changes, setChanges] = useState<WorkspaceChangeEntry[]>([])
  const [composerRefill, setComposerRefill] = useState<{
    text: string
    skillRefs?: Array<{ command: string; content: string }>
    nonce: number
  } | null>(null)
  const syncedFolderKeysRef = useRef(new Set<string>())
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>(() =>
    getReasoningEffortForModel(chrome.model.currentProviderId, chrome.model.currentModelId)
  )
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)

  const reasoningProviderType = useMemo(() => {
    const providerId = chrome.model.currentProviderId
    const provider = chrome.providers.find((p) => p.id === providerId)
    return provider?.type || providerId || undefined
  }, [chrome.model.currentProviderId, chrome.providers])

  const reasoningControl = useMemo(
    () =>
      getReasoningControlForModel(chrome.model.currentModelId || '', reasoningProviderType),
    [chrome.model.currentModelId, reasoningProviderType]
  )

  useEffect(() => {
    const next = getReasoningEffortForModel(
      chrome.model.currentProviderId,
      chrome.model.currentModelId
    )
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [chrome.model.currentProviderId, chrome.model.currentModelId])

  const handleReasoningEffortChange = useCallback(
    (value: ReasoningEffortSetting) => {
      const normalized = normalizeReasoningEffortSetting(value)
      setReasoningEffort(normalized)
      setSessionReasoningEffortOverride(normalized)
      if (chrome.model.currentProviderId && chrome.model.currentModelId) {
        setReasoningEffortForModel(
          chrome.model.currentProviderId,
          chrome.model.currentModelId,
          normalized
        )
        setReasoningPreviewTick((n) => n + 1)
      }
    },
    [chrome.model.currentProviderId, chrome.model.currentModelId]
  )

  const modelReasoningPreviews = useMemo(
    () => buildModelReasoningPreviewMap(chrome.providers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after persist
    [chrome.providers, reasoningPreviewTick, chrome.showModelSwitcher]
  )

  const effortSuffix = formatReasoningControlPreview({
    modelId: chrome.model.currentModelId,
    providerTypeOrId: reasoningProviderType,
    effort: reasoningEffort
  })

  const openModelSwitcher = useCallback(
    (anchorRect?: DOMRect | null) => {
      setModelMenuAnchor(anchorRect ?? null)
      chrome.setShowModelSwitcher(true)
    },
    [chrome]
  )

  const stream = useWorkspaceAgentStream(streamBindId)
  const chat = useWorkspaceChatMessages({
    sessionId: streamBindId ?? sessionId,
    isStreaming: stream.isStreaming,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning
  })

  useEffect(() => {
    if (sessionId && sessionId !== 'new-session') {
      setBoundStreamSessionId(sessionId)
      return
    }
    // /open/:workspaceId 为空白新对话：必须解绑上一会话，否则会继续展示旧消息
    if (routeWorkspaceId) {
      setBoundStreamSessionId(undefined)
    }
  }, [routeWorkspaceId, sessionId])

  // 助手消息已落库后清掉流式桥接，避免与落库气泡短暂并存
  useEffect(() => {
    const sid = streamBindId ?? sessionId
    if (!sid || sid === 'new-session' || !stream.isBridgeActive) return
    const last = chat.messages[chat.messages.length - 1]
    if (
      last?.role === 'assistant' &&
      (Boolean(last.content?.trim()) ||
        Boolean(last.reasoning?.trim()) ||
        (last.parts?.length ?? 0) > 0)
    ) {
      clearStreamBridgeForSession(sid)
    }
  }, [chat.messages, sessionId, stream.isBridgeActive, streamBindId])

  const pendingGate = stream.pendingAgentGate
  const gateSessionId = streamBindId ?? sessionId
  const gateQueueIndex = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, gateSessionId, pendingGate?.id).index
  )
  const gateQueueTotal = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, gateSessionId, pendingGate?.id).total
  )
  const sameActionCount = useAgentGateInboxStore((state) =>
    selectSameActionCountInSession(state, gateSessionId, pendingGate?.action)
  )
  useStreamError(stream.error, stream.isStreaming)
  const resolvedActiveWorkspace =
    activeWorkspace ??
    (routeWorkspaceId ? workspaces.find((entry) => entry.id === routeWorkspaceId) : undefined) ??
    (folderRoot
      ? workspaces.find((entry) => workspaceEntryMatchesFolder(entry, folderRoot))
      : undefined) ??
    null
  const activeFolderRoot = resolvedActiveWorkspace?.folderRoot ?? folderRoot
  const hasWorkspace = Boolean(activeFolderRoot)

  const openWorkspacePath = useCallback((workspaceId: string) => {
    return `/agent-workspace/open/${workspaceId}`
  }, [])

  // 从 /open/:workspaceId 进入：校验并选中目录
  useEffect(() => {
    if (!routeWorkspaceId || loadingWorkspaces) return
    const target = workspaces.find((entry) => entry.id === routeWorkspaceId)
    if (!target) {
      navigate('/agent-workspace', { replace: true })
      return
    }
    if (activeWorkspace?.id !== target.id) {
      void selectWorkspace(target.id)
    }
    if (folderRoot !== target.folderRoot) {
      setFolderRoot(target.folderRoot)
    }
  }, [
    activeWorkspace?.id,
    folderRoot,
    loadingWorkspaces,
    navigate,
    routeWorkspaceId,
    selectWorkspace,
    setFolderRoot,
    workspaces
  ])

  // 从会话深链进入：按 binding 恢复目录
  useEffect(() => {
    if (!sessionId || sessionId === 'new-session' || routeWorkspaceId) return
    let cancelled = false
    void window.api?.agentWorkspace
      ?.getBinding?.(sessionId)
      .then((binding) => {
        if (cancelled || !binding?.folderRoot) return
        setFolderRoot(binding.folderRoot)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [routeWorkspaceId, sessionId, setFolderRoot])

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

  const handleBackToHome = useCallback(() => {
    setFolderRoot(null)
    navigate('/agent-workspace')
  }, [navigate, setFolderRoot])

  const handleAddWorkspace = useCallback(async () => {
    try {
      const entry = await addWorkspaceFromPicker()
      if (entry) {
        setFolderRoot(entry.folderRoot)
        navigate(openWorkspacePath(entry.id))
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
  }, [addWorkspaceFromPicker, dialog, navigate, openWorkspacePath, setFolderRoot, t])

  const handleNewSession = useCallback(() => {
    const id = resolvedActiveWorkspace?.id ?? routeWorkspaceId
    if (!id) return
    if (stream.isStreaming) {
      stream.stopChat()
    }
    const previousBind =
      (sessionId && sessionId !== 'new-session' ? sessionId : boundStreamSessionId) || undefined
    if (previousBind) {
      clearStreamBridgeForSession(previousBind)
    }
    setBoundStreamSessionId(undefined)
    setChanges([])
    setComposerRefill(null)
    navigate(openWorkspacePath(id))
  }, [
    boundStreamSessionId,
    navigate,
    openWorkspacePath,
    resolvedActiveWorkspace?.id,
    routeWorkspaceId,
    sessionId,
    stream
  ])

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
          const id = resolvedActiveWorkspace?.id
          navigate(id ? openWorkspacePath(id) : '/agent-workspace')
        }
      } catch (error) {
        console.error('[AgentWorkspaceScreen] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, navigate, openWorkspacePath, resolvedActiveWorkspace?.id, sessionId, t]
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

  const {
    model: { currentProviderId, currentModelId },
    selectedAssistantId
  } = chrome

  const searchModeEnabled = useAgentStore((s) => s.searchMode)

  const messageActions = useWorkspaceMessageActions({
    t,
    sessionId: streamBindId ?? sessionId,
    folderRoot: activeFolderRoot,
    messages: chat.messages,
    isStreaming: stream.isStreaming,
    currentProviderId,
    currentModelId,
    selectedAssistantId,
    searchModeEnabled,
    getReasoningEffort: () => getSessionReasoningEffortOverride(),
    isModelReady: () =>
      isConfiguredProviderId(currentProviderId) && isConfiguredDialogueModelId(currentModelId),
    onModelNotReady: () => openModelSwitcher(null),
    stopChat: stream.stopChat,
    rollbackRound: stream.rollbackRound,
    previewRollback: stream.previewRollback,
    prepareWorkspaceTurn: stream.prepareWorkspaceTurn,
    admitAndStream: async ({
      sessionId: admitSessionId,
      text,
      userMessageId,
      providerId,
      modelId,
      reasoningEffort,
      searchMode
    }) => {
      setBoundStreamSessionId(admitSessionId)
      chat.setStreamSessionId(admitSessionId)
      void chat.refresh(admitSessionId)
      const admitted = await window.api.agentWorkspace.admit({
        sessionId: admitSessionId,
        text,
        delivery: 'queue',
        userMessageId,
        providerId,
        modelId,
        reasoningEffort,
        searchMode
      })
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-pending-inputs-changed', {
          detail: { sessionId: admitSessionId }
        })
      )
      if (admitted.queued) {
        toast.showInfo(
          t('agent_workspace.input_accepted_busy', '已收到，当前轮次结束后继续')
        )
        return
      }

      if (admitted.started) {
        stream.beginStreaming(admitSessionId)
        notifyWorkspaceSessionsChanged()
      }
    },
    refreshMessages: async (sid) => {
      await chat.refresh(sid)
    },
    notifySessionsChanged: notifyWorkspaceSessionsChanged,
    setComposerRefill,
    onCreatedNewSession: (id) => navigate(`/agent-workspace/${id}`)
  })

  const handleSend = useCallback(
    async (
      text: string,
      _attachments?: unknown[],
      searchMode?: boolean,
      meta?: {
        displayText?: string
        skillRefs?: Array<{ command: string; content: string }>
        delivery?: 'steer' | 'queue'
      }
    ) => {
      const trimmed = text.trim()
      if (!trimmed) return

      if (
        !isConfiguredProviderId(currentProviderId) ||
        !isConfiguredDialogueModelId(currentModelId)
      ) {
        openModelSwitcher(null)
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

      const displayText = meta?.displayText?.trim() || trimmed
      const skillRefs = meta?.skillRefs?.length ? meta.skillRefs : undefined
      const effectiveSearchMode = searchMode ?? searchModeEnabled
      const delivery = meta?.delivery ?? 'queue'

      try {
        const prepared = await stream.prepareWorkspaceTurn(sessionId, trimmed, folder, {
          assistantId: selectedAssistantId,
          displayText,
          skillRefs
        })

        setBoundStreamSessionId(prepared.sessionId)
        chat.setStreamSessionId(prepared.sessionId)
        void chat.refresh(prepared.sessionId)

        if (prepared.createdNew && prepared.sessionId !== sessionId) {
          navigate(`/agent-workspace/${prepared.sessionId}`)
        }

        // 空闲与忙时统一：prepare → admit →（idle 时主进程 drain 开流）
        const admitted = await window.api.agentWorkspace.admit({
          sessionId: prepared.sessionId,
          text: trimmed,
          delivery,
          userMessageId: prepared.userMessageId,
          providerId: currentProviderId,
          modelId: currentModelId,
          reasoningEffort: getSessionReasoningEffortOverride(),
          searchMode: effectiveSearchMode
        })
        window.dispatchEvent(
          new CustomEvent('baishou:workspace-pending-inputs-changed', {
            detail: { sessionId: prepared.sessionId }
          })
        )

        if (admitted.queued) {
          toast.showInfo(
            t('agent_workspace.input_accepted_busy', '已收到，当前轮次结束后继续')
          )
          return
        }

        if (admitted.started) {
          stream.beginStreaming(prepared.sessionId)
          notifyWorkspaceSessionsChanged()
        }
      } catch (error) {
        console.error('[AgentWorkspaceScreen] send failed:', error)
      }
    },
    [
      activeFolderRoot,
      addWorkspaceFromPicker,
      chat,
      currentModelId,
      currentProviderId,
      navigate,
      openModelSwitcher,
      searchModeEnabled,
      selectedAssistantId,
      sessionId,
      setFolderRoot,
      stream,
      t,
      toast
    ]
  )

  useWorkspaceInitMessage({
    searchParams,
    setSearchParams,
    sessionId,
    activeFolderRoot,
    isStreaming: stream.isStreaming,
    loadingWorkspaces,
    currentProviderId,
    currentModelId,
    setShowModelSwitcher: (open) => {
      if (open) openModelSwitcher(null)
      else chrome.setShowModelSwitcher(false)
    },
    onSend: handleSend
  })

  const layoutScopeKey =
    routeWorkspaceId ?? resolvedActiveWorkspace?.id ?? activeFolderRoot

  return (
    <div className={styles.screen}>
      <WorkbenchShell
        folderRoot={activeFolderRoot}
        layoutScopeKey={layoutScopeKey}
        workspace={resolvedActiveWorkspace}
        sessions={sessions}
        loadingSessions={loadingSessions}
        activeSessionId={sessionId}
        changes={changes}
        onOpenFolder={() => void handleAddWorkspace()}
        onBackToHome={handleBackToHome}
        onNewSession={handleNewSession}
        onSelectSession={(id) => void handleSelectSession(id)}
        onDeleteSession={(id) => void handleDeleteSession(id)}
        onRenameSession={(id, title) => void handleRenameSession(id, title)}
        agentPanel={{
          hasWorkspace,
          hasConfiguredModel,
          sessionId: streamBindId ?? sessionId,
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
            onModelClick: (anchorRect) => openModelSwitcher(anchorRect),
            effortSuffix,
            onCostClick: () => chrome.setShowCostDialog(true)
          },
          chat: {
            messages: chat.messages,
            pendingAssistantMsg: chat.pendingAssistantMsg
          },
          stream: {
            text: stream.text,
            reasoning: stream.reasoning,
            timeline: stream.timeline,
            isStreaming: stream.isStreaming,
            isBridgeActive: stream.isBridgeActive,
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
          onSend: (text, attachments, searchMode, meta) => void handleSend(text, attachments, searchMode, meta),
          onRollbackRound: (id) => void messageActions.handleRollback(id),
          onEditResend: (id, text, meta) => messageActions.handleEditResend(id, text, meta),
          onChangesUpdate: handleChangesUpdate,
          onAssistantTap: () => chrome.setShowAssistantPicker(true),
          assistantName: chrome.currentAssistant?.name || t('agent.partner_label', '伙伴'),
          composerRefill,
          gateBlocksComposer: Boolean(pendingGate),
          gateSlot: (
            <AgentGateDock
              request={pendingGate}
              isReplying={stream.isAgentGateReplying}
              onReply={(payload) => void stream.replyAgentGate(payload)}
              queueIndex={gateQueueIndex}
              queueTotal={gateQueueTotal}
              sameActionCount={sameActionCount}
              placement="inline"
            />
          )
        }}
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
        <SessionModelMenu
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
          }}
          onManageProviders={() => navigate(`${SETTINGS_HUB_PREFIX}/ai-services`)}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={handleReasoningEffortChange}
          reasoningControl={reasoningControl}
          modelReasoningPreviews={modelReasoningPreviews}
          anchorRect={modelMenuAnchor}
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
