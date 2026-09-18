import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AgentGateDock, useDialog, toast } from '@baishou/ui'
import { isConfiguredDialogueModelId, isConfiguredProviderId } from '@baishou/shared'
import {
  selectSameActionCountInSession,
  useAgentGateInboxStore,
  useAgentStore
} from '@baishou/store'
import { useWorkspaceAgentStream } from './hooks/useWorkspaceAgentStream'
import { useWorkspaceChatMessages } from './hooks/useWorkspaceChatMessages'
import { useWorkspaceMessageActions } from './hooks/useWorkspaceMessageActions'
import { useWorkspaceContextChain } from './hooks/useWorkspaceContextChain'
import { useWorkspaceRuntimeRefresh } from './hooks/useWorkspaceRuntimeRefresh'
import { useWorkspaceSessions } from './hooks/useWorkspaceSessions'
import { useAgentWorkspaces } from './hooks/useAgentWorkspaces'
import { useAgentWorkspaceChrome } from './hooks/useAgentWorkspaceChrome'
import { useWorkspaceInitMessage } from './hooks/useWorkspaceInitMessage'
import { useAgentWorkspaceComposerSend } from './hooks/useAgentWorkspaceComposerSend'
import { useAgentWorkspaceFolderBinding } from './hooks/useAgentWorkspaceFolderBinding'
import { useAgentWorkspaceReasoningChrome } from './hooks/useAgentWorkspaceReasoningChrome'
import { useAgentWorkspaceSessionActions } from './hooks/useAgentWorkspaceSessionActions'
import { useStreamError } from '../agent/hooks/useStreamError'
import { useAgentGateQueuePager } from '../agent/hooks/useAgentGateQueuePager'
import { clearStreamBridgeForSession } from '../agent/hooks/agent-stream-session-store'
import { getSessionReasoningEffortOverride } from '../agent/reasoning-effort-session'
import { hasPersistedAssistantTail } from './utils/workspace-persisted-assistant.util'
import {
  isPersistedWorkspaceSessionId,
  nextBoundStreamSessionId,
  notifyWorkspaceSessionsChanged,
  resolveActiveWorkspace,
  resolveLayoutScopeKey
} from './utils/agent-workspace-screen.util'
import { AgentWorkspaceScreenOverlays } from './AgentWorkspaceScreenOverlays'
import { WorkbenchShell } from './workbench/WorkbenchShell'
import styles from './AgentWorkspaceScreen.module.css'

interface WorkspaceOutletContext {
  folderRoot: string | null
  setFolderRoot: (path: string | null) => void
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
  const streamBindId = isPersistedWorkspaceSessionId(sessionId) ? sessionId : boundStreamSessionId
  const chrome = useAgentWorkspaceChrome(streamBindId ?? sessionId)
  const { sessions, loading: loadingSessions } = useWorkspaceSessions()
  const [composerRefill, setComposerRefill] = useState<{
    text: string
    skillRefs?: Array<{ command: string; content: string }>
    nonce: number
  } | null>(null)
  const reasoning = useAgentWorkspaceReasoningChrome(chrome)
  const stream = useWorkspaceAgentStream(streamBindId)
  const chat = useWorkspaceChatMessages({
    sessionId: streamBindId ?? sessionId,
    isStreaming: stream.isStreaming,
    streamingText: stream.text,
    streamingReasoning: stream.reasoning
  })

  useEffect(() => {
    const next = nextBoundStreamSessionId({ sessionId, routeWorkspaceId })
    if (!next.replace) return
    setBoundStreamSessionId(next.next)
  }, [routeWorkspaceId, sessionId])

  // 助手消息已落库后清掉流式桥接，避免与落库气泡短暂并存
  useEffect(() => {
    const sid = streamBindId ?? sessionId
    if (!isPersistedWorkspaceSessionId(sid) || !stream.isBridgeActive) return
    if (hasPersistedAssistantTail(chat.messages)) {
      clearStreamBridgeForSession(sid)
    }
  }, [chat.messages, sessionId, stream.isBridgeActive, streamBindId])

  const pendingGate = stream.pendingAgentGate
  const gateSessionId = streamBindId ?? sessionId
  const {
    queueIndex: gateQueueIndex,
    queueTotal: gateQueueTotal,
    onQueuePrev,
    onQueueNext
  } = useAgentGateQueuePager(gateSessionId, pendingGate?.id)
  const sameActionCount = useAgentGateInboxStore((state) =>
    selectSameActionCountInSession(state, gateSessionId, pendingGate?.action)
  )
  useStreamError(stream.error, stream.isStreaming)
  const resolvedActiveWorkspace = resolveActiveWorkspace({
    activeWorkspace,
    routeWorkspaceId,
    workspaces,
    folderRoot
  })
  const activeFolderRoot = resolvedActiveWorkspace?.folderRoot ?? folderRoot
  const hasWorkspace = Boolean(activeFolderRoot)
  const navigateHome = useCallback(() => {
    navigate('/agent-workspace', { replace: true })
  }, [navigate])

  useAgentWorkspaceFolderBinding({
    routeWorkspaceId,
    sessionId,
    folderRoot,
    setFolderRoot,
    workspaces,
    loadingWorkspaces,
    activeWorkspaceId: activeWorkspace?.id,
    resolvedWorkspaceId: resolvedActiveWorkspace?.id,
    resolvedFolderRoot: resolvedActiveWorkspace?.folderRoot,
    selectWorkspace,
    registerWorkspaceFolder,
    navigateHome
  })

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

  const sessionActions = useAgentWorkspaceSessionActions({
    t,
    dialog,
    navigate,
    sessionId,
    routeWorkspaceId,
    boundStreamSessionId,
    setBoundStreamSessionId,
    setComposerRefill,
    setFolderRoot,
    resolvedWorkspaceId: resolvedActiveWorkspace?.id,
    workspaces,
    selectWorkspace,
    addWorkspaceFromPicker,
    isStreaming: stream.isStreaming,
    stopChat: stream.stopChat
  })

  const {
    model: { currentProviderId, currentModelId },
    selectedAssistantId
  } = chrome

  const searchModeEnabled = useAgentStore((s) => s.searchMode)

  const handleSend = useAgentWorkspaceComposerSend({
    t,
    sessionId,
    activeFolderRoot,
    currentProviderId,
    currentModelId,
    selectedAssistantId,
    searchModeEnabled,
    addWorkspaceFromPicker,
    setFolderRoot,
    setBoundStreamSessionId,
    navigate,
    openModelSwitcher: reasoning.openModelSwitcher,
    stream,
    chat
  })

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
    onModelNotReady: () => reasoning.openModelSwitcher(null),
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
        searchMode,
        forceStart: true
      })
      window.dispatchEvent(
        new CustomEvent('baishou:workspace-pending-inputs-changed', {
          detail: { sessionId: admitSessionId }
        })
      )
      if (admitted.queued) {
        toast.showInfo(t('agent_workspace.input_accepted_busy', '已收到，当前轮次结束后继续'))
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

  const contextChain = useWorkspaceContextChain({
    sessionId: streamBindId ?? sessionId,
    searchModeEnabled
  })

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
      if (open) reasoning.openModelSwitcher(null)
      else chrome.setShowModelSwitcher(false)
    },
    onSend: handleSend
  })

  const layoutScopeKey = resolveLayoutScopeKey({
    routeWorkspaceId,
    workspaceId: resolvedActiveWorkspace?.id,
    folderRoot: activeFolderRoot
  })

  return (
    <div className={styles.screen}>
      <WorkbenchShell
        folderRoot={activeFolderRoot}
        layoutScopeKey={layoutScopeKey}
        workspace={resolvedActiveWorkspace}
        sessions={sessions}
        loadingSessions={loadingSessions}
        activeSessionId={sessionId}
        onOpenFolder={() => void sessionActions.handleAddWorkspace()}
        onBackToHome={sessionActions.handleBackToHome}
        onNewSession={sessionActions.handleNewSession}
        onSelectSession={(id) => void sessionActions.handleSelectSession(id)}
        onDeleteSession={(id) => void sessionActions.handleDeleteSession(id)}
        onRenameSession={(id, title) => void sessionActions.handleRenameSession(id, title)}
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
            totalCacheReadInputTokens: chrome.tokens.totalCacheReadInputTokens,
            totalCacheWriteInputTokens: chrome.tokens.totalCacheWriteInputTokens,
            estimatedCost: chrome.tokens.estimatedCost,
            onAssistantClick: () => chrome.setShowAssistantPicker(true),
            onModelClick: (anchorRect) => reasoning.openModelSwitcher(anchorRect),
            effortSuffix: reasoning.effortSuffix,
            pricingLastUpdated: chrome.pricingLastUpdated,
            onRefreshPricing: chrome.handleRefreshPricing
          },
          chat: {
            messages: chat.messages,
            pendingAssistantMsg: chat.pendingAssistantMsg,
            hasMore: chat.hasMore,
            loadMore: chat.loadMore
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
          onSend: (text, attachments, searchMode, meta) =>
            handleSend(text, attachments, searchMode, meta),
          onEditResend: (id, text, meta) => messageActions.handleEditResend(id, text, meta),
          bubbleActions: {
            onResend: (id) => {
              void messageActions.handleResend(id)
            },
            onRegenerate: (id) => {
              void messageActions.handleRegenerate(id)
            },
            onDelete: (id) => {
              void messageActions.handleDelete(id)
            },
            onShowContext: (msg) => {
              void contextChain.showContext(msg)
            },
            onSaveAssistantEdit: (id, text) => messageActions.handleSaveAssistantEdit(id, text)
          },
          onAssistantTap: () => chrome.setShowAssistantPicker(true),
          assistantName: chrome.currentAssistant?.name || t('agent.partner_label', '伙伴'),
          composerRefill,
          gateBlocksComposer: Boolean(pendingGate),
          pendingAsk: pendingGate,
          isAskReplying: stream.isAgentGateReplying,
          onAskReply: (payload) => void stream.replyAgentGate(payload),
          gateSlot: (
            <AgentGateDock
              request={pendingGate}
              isReplying={stream.isAgentGateReplying}
              onReply={(payload) => void stream.replyAgentGate(payload)}
              queueIndex={gateQueueIndex}
              queueTotal={gateQueueTotal}
              onQueuePrev={onQueuePrev}
              onQueueNext={onQueueNext}
              sameActionCount={sameActionCount}
              placement="inline"
            />
          )
        }}
      />

      <AgentWorkspaceScreenOverlays
        chrome={chrome}
        contextChain={contextChain}
        streamBindId={streamBindId}
        sessionId={sessionId}
        navigate={navigate}
        reasoningEffort={reasoning.reasoningEffort}
        onReasoningEffortChange={reasoning.handleReasoningEffortChange}
        reasoningControl={reasoning.reasoningControl}
        modelReasoningPreviews={reasoning.modelReasoningPreviews}
        modelMenuAnchor={reasoning.modelMenuAnchor}
      />
    </div>
  )
}
