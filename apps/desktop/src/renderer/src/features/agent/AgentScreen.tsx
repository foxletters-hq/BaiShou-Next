import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  InputBar,
  SessionContextUsageRing,
  useTheme,
  getProviderIcon,
  toast,
  useReasoningCatalogEpoch
} from '@baishou/ui'
import { createWebComposerDraftStorage } from '@baishou/ui/shared/composer-draft'
import {
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  getReasoningControlForModel,
  type ReasoningEffortSetting,
  normalizeReasoningEffortSetting,
  resolveDialogueEffortPreference
} from '@baishou/shared'
import { selectSameActionCountInSession, useAgentGateInboxStore } from '@baishou/store'
import { WorkbenchNotebookMountDialog } from '../agent-workspace/workbench/WorkbenchNotebookMountDialog'
import { KnowledgeMountHint } from '../knowledge/KnowledgeMountHint'
import { AgentChatEmptyState } from './AgentChatEmptyState'
import { AgentCompanionGateDock } from './AgentCompanionGateDock'
import { AgentContextChainHost } from './AgentContextChainHost'
import { AgentDialogs } from './components/AgentDialogs'
import { AgentMessageList } from './components/AgentMessageList'
import { AgentChatChrome } from './components/AgentChatChrome'
import chromeStyles from './components/AgentChatChrome.module.css'
import { useAgentChatFlow } from './hooks/useAgentChatFlow'
import { useDesktopComposerDraftKey } from './hooks/useDesktopComposerDraftKey'
import { useAgentGateQueuePager } from './hooks/useAgentGateQueuePager'
import { refreshDesktopAgentGateInbox } from './agent-gate-inbox-bridge'
import { resolveCompanionAskDockRequest } from './utils/running-companion-ask-request.util'
import { resolveCompanionStreamUi } from './utils/companion-stream-ui.util'
import { excludePendingQueuedUserMessages } from './utils/pending-queue-messages.util'
import { ComposerQueueEditTag, ComposerRuntimeQueueBar } from './components/ComposerRuntimeQueueBar'
import { useComposerPendingQueue } from './hooks/useComposerPendingQueue'
import type { AgentOutletContext } from './agent-outlet-context'
import styles from './AgentScreen.module.css'
import { Cloud, Sparkles, ChevronUp } from 'lucide-react'
import {
  getReasoningEffortForModel,
  setReasoningEffortForModel,
  setSessionReasoningEffortOverride
} from './reasoning-effort-session'
import {
  buildModelReasoningPreviewMap,
  formatReasoningControlPreview
} from './format-reasoning-control-preview'
import { useDialogueSlotEffort } from './use-dialogue-slot-effort'
import { isDraftChatSessionId } from './utils/draft-chat-session.util'

/**
 * Agent 大模型聊天屏幕主页面组件。
 * 本组件已彻底重构为容器组件，仅负责高层框架布局，业务逻辑与渲染控制已分别下沉至 useAgentChatFlow 和子组件中。
 */
export const AgentScreen: React.FC = () => {
  const flow = useAgentChatFlow()
  const { isDark } = useTheme()
  const {
    currentAssistant,
    onShowAssistantPicker,
    onAssistantSwitched,
    onNewSession,
    onOpenSessions
  } = useOutletContext<AgentOutletContext>()

  const providerIconUrl = useMemo(() => {
    const providerId = flow.model.currentProviderId
    if (!providerId || providerId === 'unknown') return undefined
    const providerRecord = flow.providers.find((provider) => provider.id === providerId)
    return (
      getProviderIcon(providerId, isDark) ||
      (providerRecord?.type ? getProviderIcon(providerRecord.type, isDark) : undefined)
    )
  }, [flow.model.currentProviderId, flow.providers, isDark])

  const noModelSelected = !isConfiguredDialogueModelId(flow.model.currentModelId)
  const modelTriggerRef = useRef<HTMLButtonElement>(null)
  const [notebookMountOpen, setNotebookMountOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (searchParams.get('focus') !== 'notebook-mount') return
    setNotebookMountOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const displayModelName = noModelSelected
    ? flow.t('agent.no_model_selected', '暂未选择模型')
    : flow.model.currentModelId

  const dialogueSlotEffort = useDialogueSlotEffort()
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>(() =>
    resolveDialogueEffortPreference(
      getReasoningEffortForModel(flow.model.currentProviderId, flow.model.currentModelId),
      dialogueSlotEffort
    )
  )
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)

  const reasoningProviderType = useMemo(() => {
    const providerId = flow.model.currentProviderId
    const provider = flow.providers.find((p) => p.id === providerId)
    return provider?.type || providerId || undefined
  }, [flow.model.currentProviderId, flow.providers])

  const reasoningCatalogEpoch = useReasoningCatalogEpoch()
  const reasoningControl = useMemo(() => {
    // 目录热更新只改模块表、不改 modelId；引用 epoch 才能按新表重算
    void reasoningCatalogEpoch
    return getReasoningControlForModel(flow.model.currentModelId || '', reasoningProviderType)
  }, [flow.model.currentModelId, reasoningProviderType, reasoningCatalogEpoch])

  // 切换模型时：按模型记忆优先，否则用对话用途分档
  useEffect(() => {
    const next = resolveDialogueEffortPreference(
      getReasoningEffortForModel(flow.model.currentProviderId, flow.model.currentModelId),
      dialogueSlotEffort
    )
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [dialogueSlotEffort, flow.model.currentProviderId, flow.model.currentModelId])

  const handleReasoningEffortChange = (value: ReasoningEffortSetting) => {
    const normalized = normalizeReasoningEffortSetting(value)
    setReasoningEffort(normalized)
    setSessionReasoningEffortOverride(normalized)
    if (flow.model.currentProviderId && flow.model.currentModelId) {
      setReasoningEffortForModel(
        flow.model.currentProviderId,
        flow.model.currentModelId,
        normalized
      )
      setReasoningPreviewTick((n) => n + 1)
    }
  }

  const modelReasoningPreviews = useMemo(
    () => buildModelReasoningPreviewMap(flow.providers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick refreshes after persist
    [flow.providers, reasoningPreviewTick, flow.showModelSwitcher]
  )

  const effortSuffix = formatReasoningControlPreview({
    modelId: flow.model.currentModelId,
    providerTypeOrId: reasoningProviderType,
    effort: reasoningEffort
  })

  const openModelSwitcher = () => {
    setModelMenuAnchor(modelTriggerRef.current?.getBoundingClientRect() ?? null)
    flow.setShowModelSwitcher(true)
  }

  const modelSwitcherButton = (
    <button
      ref={modelTriggerRef}
      type="button"
      className={`${chromeStyles.modelSwitcherTrigger} ${chromeStyles.modelSwitcherInComposer}`}
      onClick={openModelSwitcher}
      aria-label={flow.t('models.switch_model', '切换模型')}
      title={flow.t('models.switch_model', '切换模型')}
    >
      <span className={chromeStyles.modelProviderIcon} aria-hidden>
        {providerIconUrl ? (
          <img src={providerIconUrl} alt="" />
        ) : noModelSelected ? (
          <Sparkles size={14} />
        ) : (
          <Cloud size={14} />
        )}
      </span>
      <span className={chromeStyles.modelName}>{displayModelName}</span>
      {effortSuffix ? <span className={chromeStyles.modelEffort}>{effortSuffix}</span> : null}
      <ChevronUp size={12} strokeWidth={2.2} className={chromeStyles.chevron} />
    </button>
  )

  const tokenUsageRing = (
    <SessionContextUsageRing
      messages={flow.chat.messages}
      modelId={flow.model.currentModelId}
      totals={flow.tokens}
      pricingLastUpdated={flow.pricingLastUpdated}
      onRefreshPricing={flow.handleRefreshPricing}
    />
  )

  const composerDraftStorage = useMemo(() => createWebComposerDraftStorage(), [])
  const composerDraftKey = useDesktopComposerDraftKey(flow.sessionId)
  const pendingGate = flow.stream.pendingAgentGate
  const dockRequest = resolveCompanionAskDockRequest({
    pendingGate,
    sessionId: flow.sessionId,
    timeline: flow.stream.timeline,
    isStreaming: flow.stream.isStreaming
  })
  const hasPendingGate = Boolean(dockRequest)
  const askingCallIds = flow.stream.timeline
    .filter(
      (
        item
      ): item is Extract<import('@baishou/shared').AgentStreamTimelineItem, { kind: 'tool' }> =>
        item.kind === 'tool' && item.name === 'companion_ask' && item.status === 'running'
    )
    .map((item) => item.callId)
    .join(',')
  useEffect(() => {
    if (!askingCallIds || pendingGate) return
    // 工具名到达时确认门往往还没挂上，只拉一次会落空；流还开着就继续补拉
    void refreshDesktopAgentGateInbox()
    const timer = window.setInterval(() => {
      void refreshDesktopAgentGateInbox()
    }, 500)
    return () => window.clearInterval(timer)
  }, [askingCallIds, pendingGate])
  const {
    queueIndex: gateQueueIndex,
    queueTotal: gateQueueTotal,
    onQueuePrev,
    onQueueNext
  } = useAgentGateQueuePager(flow.sessionId, pendingGate?.id, 'companion')
  const sameActionCount = useAgentGateInboxStore((state) =>
    selectSameActionCountInSession(state, flow.sessionId, pendingGate?.action, 'companion')
  )
  const composerBlocked =
    hasPendingGate ||
    !isConfiguredProviderId(flow.model.currentProviderId) ||
    !isConfiguredDialogueModelId(flow.model.currentModelId)
  const lastChatMessage = flow.chat.messages[flow.chat.messages.length - 1]
  const companionStreamUi = resolveCompanionStreamUi({
    isStreaming: flow.stream.isStreaming,
    isBridgeActive: flow.stream.isBridgeActive,
    isCompressing: flow.stream.isCompressing,
    error: flow.stream.error,
    lastMessage: lastChatMessage,
    text: flow.stream.text,
    reasoning: flow.stream.reasoning,
    timeline: flow.stream.timeline,
    activeTool: flow.stream.activeTool,
    completedToolsCount: flow.stream.completedTools.length
  })
  const pendingQueueCtl = useComposerPendingQueue({
    sessionId: flow.sessionId,
    scope: 'companion',
    refreshTrigger: flow.stream.isStreaming
  })
  const displayChat = useMemo(() => {
    const messages = excludePendingQueuedUserMessages(
      flow.chat.messages,
      pendingQueueCtl.pendingQueue
    )
    if (messages === flow.chat.messages) return flow.chat
    return { ...flow.chat, messages }
  }, [flow.chat, pendingQueueCtl.pendingQueue])

  const chatBackgroundUrl = flow.userProfile?.chatBackgroundPath
  const chatBackgroundBlur = normalizeChatBackgroundBlur(flow.userProfile?.chatBackgroundBlur)
  const chatBackgroundOverlay = normalizeChatBackgroundOverlayOpacity(
    flow.userProfile?.chatBackgroundOverlayOpacity
  )

  /** 未自动加载上次对话 / 新对话草稿：居中展示欢迎区 + 输入框（有真实 sessionId 时不闪空态） */
  const isEmptyIdle =
    isDraftChatSessionId(flow.sessionId) &&
    displayChat.messages.length === 0 &&
    !flow.stream.isStreaming &&
    !flow.stream.isBridgeActive &&
    !flow.stream.isCompressing

  return (
    <div className={styles.screen}>
      {chatBackgroundUrl ? (
        <>
          <div
            className={styles.chatBackground}
            style={{
              backgroundImage: `url(${chatBackgroundUrl})`,
              filter: chatBackgroundBlur > 0 ? `blur(${chatBackgroundBlur}px)` : undefined,
              transform: chatBackgroundBlur > 0 ? 'scale(1.06)' : undefined
            }}
            aria-hidden
          />
          {chatBackgroundOverlay > 0 ? (
            <div
              className={styles.chatBackgroundOverlay}
              style={{ backgroundColor: `rgba(0, 0, 0, ${chatBackgroundOverlay / 100})` }}
              aria-hidden
            />
          ) : null}
        </>
      ) : null}
      <AgentChatChrome
        currentAssistant={currentAssistant}
        onShowPicker={onShowAssistantPicker}
        onAssistantSwitched={(assistant) => void onAssistantSwitched?.(assistant)}
        onNewSession={() => onNewSession?.()}
        onOpenSessions={() => onOpenSessions?.()}
      />

      {!isEmptyIdle ? (
        <AgentMessageList
          t={flow.t}
          sessionId={flow.sessionId}
          chat={displayChat}
          stream={flow.stream}
          scroll={flow.scroll}
          currentAssistant={flow.currentAssistant}
          userProfile={flow.userProfile}
          searchMode={flow.searchMode}
          model={flow.model}
          tts={flow.tts}
          setContextDialogState={flow.setContextDialogState}
          sessions={flow.sessions}
          loadSessions={flow.loadSessions}
        />
      ) : null}

      {/* 空态垂直居中；有消息时粘底。InputBar 始终挂在同一位置，避免切换时失焦/丢草稿 */}
      <div className={isEmptyIdle ? styles.emptyIdle : styles.inputFooter}>
        <div className={isEmptyIdle ? styles.emptyComposer : styles.inputContainer}>
          {isEmptyIdle ? <AgentChatEmptyState /> : null}
          {!isEmptyIdle && flow.scroll.showScrollButton ? (
            <button
              type="button"
              className={styles.scrollToBottomBtn}
              onClick={() => flow.scroll.scrollToBottom()}
              title={flow.t('agent.chat.scroll_to_bottom', '回到最新消息')}
              aria-label={flow.t('agent.chat.scroll_to_bottom', '回到最新消息')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </button>
          ) : null}
          <AgentCompanionGateDock
            flow={flow}
            dockRequest={dockRequest}
            gateQueueIndex={gateQueueIndex}
            gateQueueTotal={gateQueueTotal}
            onQueuePrev={onQueuePrev}
            onQueueNext={onQueueNext}
            sameActionCount={sameActionCount}
          />
          <KnowledgeMountHint
            sessionId={flow.sessionId}
            assistantId={flow.currentAssistant?.id}
            scope="companion"
            onOpen={() => setNotebookMountOpen(true)}
          />
          <ComposerRuntimeQueueBar
            items={pendingQueueCtl.pendingQueue}
            editingInputId={pendingQueueCtl.editingInputId}
            t={flow.t}
            onSendNow={pendingQueueCtl.sendNow}
            onEdit={(item) => {
              pendingQueueCtl.beginEdit(item)
              flow.inputBarRef.current?.restoreDraft({ text: item.text })
              flow.inputBarRef.current?.focus()
            }}
            onDelete={async (item) => {
              await pendingQueueCtl.deleteItem(item)
              if (flow.sessionId) {
                void flow.chat.refreshLatestMessages(1, flow.sessionId, { resetPagination: true })
              }
            }}
          />
          <ComposerQueueEditTag
            visible={Boolean(pendingQueueCtl.editingInputId)}
            t={flow.t}
            onDismiss={() => {
              pendingQueueCtl.cancelEdit()
              flow.inputBarRef.current?.restoreDraft({ text: '' })
            }}
          />
          <InputBar
            ref={flow.inputBarRef}
            isLoading={companionStreamUi.composerBusy}
            allowSendWhileLoading
            attachmentIntake="companion"
            onOpenNotebookMount={() => setNotebookMountOpen(true)}
            onEmptySubmit={() => {
              const head = pendingQueueCtl.pendingQueue[0]
              if (head && !pendingQueueCtl.editingInputId) void pendingQueueCtl.sendNow(head)
            }}
            onSend={async (text, attachments, search, meta) => {
              if (pendingQueueCtl.editingInputId) {
                const ok = await pendingQueueCtl.commitEdit(text)
                if (ok) flow.inputBarRef.current?.restoreDraft({ text: '' })
                return ok
              }
              return flow.handleSend(text, attachments, search, {
                ...meta,
                delivery:
                  flow.stream.isStreaming || flow.stream.isBridgeActive ? 'queue' : meta?.delivery
              })
            }}
            onStop={flow.handleStop}
            composerBlocked={composerBlocked}
            onComposerBlocked={() =>
              toast.showInfo(
                hasPendingGate
                  ? flow.t('agent_gate.composer_blocked', '请先处理待确认操作')
                  : flow.t('agent.error.no_model', '请先选择一个模型')
              )
            }
            composerDraftKey={composerDraftKey}
            composerDraftStorage={composerDraftStorage}
            shortcuts={flow.shortcuts}
            onManageShortcuts={() => flow.setShowShortcutManager(true)}
            onRecall={() => flow.setShowRecallSheet(true)}
            onOpenTools={() => flow.setShowToolManager(true)}
            searchMode={flow.searchMode}
            onToggleSearchMode={flow.toggleSearchMode}
            ttsMode={flow.tts.ttsMode}
            onToggleTtsMode={flow.tts.toggleTtsMode}
            bottomLeading={modelSwitcherButton}
            bottomTrailing={tokenUsageRing}
          />
        </div>
      </div>

      <WorkbenchNotebookMountDialog
        open={notebookMountOpen}
        sessionId={flow.sessionId}
        assistantId={flow.currentAssistant?.id}
        scope="companion"
        onClose={() => setNotebookMountOpen(false)}
      />

      {/* 对话框与抽屉弹出层组件 */}
      <AgentDialogs
        t={flow.t}
        i18n={flow.i18n}
        showAssistantPicker={flow.showAssistantPicker}
        setShowAssistantPicker={flow.setShowAssistantPicker}
        showShortcutManager={flow.showShortcutManager}
        setShowShortcutManager={flow.setShowShortcutManager}
        showRecallSheet={flow.showRecallSheet}
        setShowRecallSheet={flow.setShowRecallSheet}
        showModelSwitcher={flow.showModelSwitcher}
        setShowModelSwitcher={flow.setShowModelSwitcher}
        showToolManager={flow.showToolManager}
        setShowToolManager={flow.setShowToolManager}
        recallLookbackMonths={flow.recallLookbackMonths}
        setRecallLookbackMonths={flow.setRecallLookbackMonths}
        model={flow.model}
        assistants={flow.assistants}
        fetchAssistants={flow.fetchAssistants}
        shortcuts={flow.shortcuts}
        addShortcut={flow.addShortcut}
        updateShortcut={flow.updateShortcut}
        removeShortcut={flow.removeShortcut}
        recall={flow.recall}
        toolConfig={flow.toolConfig}
        currentAssistant={flow.currentAssistant}
        providers={flow.providers}
        inputBarRef={flow.inputBarRef}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={handleReasoningEffortChange}
        reasoningControl={reasoningControl}
        modelReasoningPreviews={modelReasoningPreviews}
        modelMenuAnchorRect={modelMenuAnchor}
      />

      <AgentContextChainHost flow={flow} />
    </div>
  )
}
