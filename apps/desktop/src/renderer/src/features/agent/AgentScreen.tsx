import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  TokenBadge,
  InputBar,
  ContextChainPanel,
  useTheme,
  getProviderIcon,
  toast,
  AgentGateDock,
  resolveDesktopAssistantAvatarSrc
} from '@baishou/ui'
import { createWebComposerDraftStorage } from '@baishou/ui/shared/composer-draft'
import {
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  getReasoningControlForModel,
  type ReasoningEffortSetting,
  normalizeReasoningEffortSetting
} from '@baishou/shared'
import {
  selectQueuePosition,
  selectSameActionCountInSession,
  useAgentGateInboxStore
} from '@baishou/store'
import { WorkbenchNotebookMountDialog } from '../agent-workspace/workbench/WorkbenchNotebookMountDialog'
import { KnowledgeMountHint } from '../knowledge/KnowledgeMountHint'
import { AgentDialogs } from './components/AgentDialogs'
import { AgentMessageList } from './components/AgentMessageList'
import { AgentChatChrome } from './components/AgentChatChrome'
import chromeStyles from './components/AgentChatChrome.module.css'
import { useAgentChatFlow } from './hooks/useAgentChatFlow'
import { useDesktopComposerDraftKey } from './hooks/useDesktopComposerDraftKey'
import type { AgentOutletContext } from './agent-outlet-context'
import styles from './AgentScreen.module.css'
import { Cloud, Sparkles, ChevronDown, History } from 'lucide-react'
import {
  getReasoningEffortForModel,
  setReasoningEffortForModel,
  setSessionReasoningEffortOverride
} from './reasoning-effort-session'
import {
  buildModelReasoningPreviewMap,
  formatReasoningControlPreview
} from './format-reasoning-control-preview'
import { useAgentIdleGreeting } from './utils/agent-idle-greeting'
import partnerWelcomeMascot from './assets/partner-welcome.png'

/** 尚未落库的草稿会话（/chat、/chat/new-session、临时 new-<ts>） */
function isDraftChatSessionId(sessionId: string | undefined): boolean {
  if (!sessionId) return true
  if (sessionId === 'new-session') return true
  return /^new-\d+$/.test(sessionId)
}

/**
 * Agent 大模型聊天屏幕主页面组件。
 * 本组件已彻底重构为容器组件，仅负责高层框架布局，业务逻辑与渲染控制已分别下沉至 useAgentChatFlow 和子组件中。
 */
export const AgentScreen: React.FC = () => {
  const flow = useAgentChatFlow()
  const idleGreeting = useAgentIdleGreeting()
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
  const [modelMenuAnchor, setModelMenuAnchor] = useState<DOMRect | null>(null)

  const displayModelName = noModelSelected
    ? flow.t('agent.no_model_selected', '暂未选择模型')
    : flow.model.currentModelId

  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortSetting>(() =>
    getReasoningEffortForModel(flow.model.currentProviderId, flow.model.currentModelId)
  )
  const [reasoningPreviewTick, setReasoningPreviewTick] = useState(0)

  const reasoningProviderType = useMemo(() => {
    const providerId = flow.model.currentProviderId
    const provider = flow.providers.find((p) => p.id === providerId)
    return provider?.type || providerId || undefined
  }, [flow.model.currentProviderId, flow.providers])

  const reasoningControl = useMemo(
    () =>
      getReasoningControlForModel(flow.model.currentModelId || '', reasoningProviderType),
    [flow.model.currentModelId, reasoningProviderType]
  )

  // 切换模型时恢复该模型记忆的档位
  useEffect(() => {
    const next = getReasoningEffortForModel(
      flow.model.currentProviderId,
      flow.model.currentModelId
    )
    setReasoningEffort(next)
    setSessionReasoningEffortOverride(next)
  }, [flow.model.currentProviderId, flow.model.currentModelId])

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

  const assistantAvatar = resolveDesktopAssistantAvatarSrc(flow.currentAssistant?.avatarPath)
  const displayAssistantName =
    flow.currentAssistant?.name || flow.t('agent.partner_label', '伙伴')

  const composerFooter = (
    <div className={styles.metaRow}>
      <div className={styles.metaLeading}>
        <button
          type="button"
          className={styles.metaChip}
          onClick={() => flow.setShowAssistantPicker(true)}
          aria-haspopup="dialog"
          aria-label={flow.t('agent.select_assistant', '选择伙伴')}
          title={flow.t('agent.select_assistant', '选择伙伴')}
        >
          <span className={styles.assistantAvatar} aria-hidden>
            <img
              key={flow.currentAssistant?.avatarPath ?? flow.currentAssistant?.id ?? 'default'}
              src={assistantAvatar}
              alt=""
            />
          </span>
          <span className={styles.metaChipLabel}>{displayAssistantName}</span>
          <ChevronDown size={12} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={styles.metaIconBtn}
          title={flow.t('agent.sidebar.recent_chats', '最近对话')}
          aria-label={flow.t('agent.sidebar.recent_chats', '最近对话')}
          onClick={() => onOpenSessions?.()}
        >
          <History size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className={styles.metaTrailing}>
        <button
          ref={modelTriggerRef}
          type="button"
          className={`${chromeStyles.modelSwitcherTrigger} ${chromeStyles.modelSwitcherInMeta}`}
          onClick={openModelSwitcher}
          aria-label={flow.t('models.switch_model', '切换模型')}
          title={flow.t('models.switch_model', '切换模型')}
        >
          <span className={chromeStyles.modelProviderIcon} aria-hidden>
            {providerIconUrl ? (
              <img src={providerIconUrl} alt="" />
            ) : noModelSelected ? (
              <Sparkles size={15} />
            ) : (
              <Cloud size={15} />
            )}
          </span>
          <span className={chromeStyles.modelName}>{displayModelName}</span>
          {effortSuffix ? <span className={chromeStyles.modelEffort}>{effortSuffix}</span> : null}
          <span className={chromeStyles.chevron}>▼</span>
        </button>
      </div>
    </div>
  )

  const composerDraftStorage = useMemo(() => createWebComposerDraftStorage(), [])
  const composerDraftKey = useDesktopComposerDraftKey(flow.sessionId)
  const pendingGate = flow.stream.pendingAgentGate
  const hasPendingGate = Boolean(pendingGate)
  const gateQueueIndex = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, flow.sessionId, pendingGate?.id).index
  )
  const gateQueueTotal = useAgentGateInboxStore(
    (state) => selectQueuePosition(state, flow.sessionId, pendingGate?.id).total
  )
  const sameActionCount = useAgentGateInboxStore((state) =>
    selectSameActionCountInSession(state, flow.sessionId, pendingGate?.action)
  )
  const composerBlocked =
    hasPendingGate ||
    !isConfiguredProviderId(flow.model.currentProviderId) ||
    !isConfiguredDialogueModelId(flow.model.currentModelId)

  const chatBackgroundUrl = flow.userProfile?.chatBackgroundPath
  const chatBackgroundBlur = normalizeChatBackgroundBlur(flow.userProfile?.chatBackgroundBlur)
  const chatBackgroundOverlay = normalizeChatBackgroundOverlayOpacity(
    flow.userProfile?.chatBackgroundOverlayOpacity
  )

  /** 未自动加载上次对话 / 新对话草稿：居中展示欢迎区 + 输入框（有真实 sessionId 时不闪空态） */
  const isEmptyIdle =
    isDraftChatSessionId(flow.sessionId) &&
    flow.chat.messages.length === 0 &&
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
      {!isEmptyIdle ? (
        <AgentChatChrome
          variant="floatingActions"
          currentAssistant={currentAssistant}
          onShowPicker={onShowAssistantPicker}
          onAssistantSwitched={(assistant) => void onAssistantSwitched?.(assistant)}
          onNewSession={() => onNewSession?.()}
          trailingControls={
            <div className={chromeStyles.trailing}>
              <TokenBadge
                variant="toolbar"
                className={chromeStyles.chip}
                inputTokens={flow.tokens.totalInputTokens}
                outputTokens={flow.tokens.totalOutputTokens}
                costMicros={flow.tokens.estimatedCost * 1000000}
                onClick={() => flow.setShowCostDialog(true)}
              />
            </div>
          }
        />
      ) : null}

      {!isEmptyIdle ? (
        <AgentMessageList
          t={flow.t}
          sessionId={flow.sessionId}
          chat={flow.chat}
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
          {isEmptyIdle ? (
            <div className={styles.emptyHero}>
              <div className={styles.emptyMascot} aria-hidden>
                <img
                  src={partnerWelcomeMascot}
                  alt=""
                  className={styles.emptyMascotImg}
                  draggable={false}
                />
              </div>
              <p className={styles.emptyGreeting}>{idleGreeting}</p>
            </div>
          ) : null}
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
          <AgentGateDock
            request={pendingGate}
            isReplying={flow.stream.isAgentGateReplying}
            onReply={flow.stream.replyAgentGate}
            queueIndex={gateQueueIndex}
            queueTotal={gateQueueTotal}
            sameActionCount={sameActionCount}
            placement="inline"
          />
          <KnowledgeMountHint
            sessionId={flow.sessionId}
            onOpen={() => setNotebookMountOpen(true)}
          />
          <InputBar
            ref={flow.inputBarRef}
            isLoading={flow.stream.isStreaming || flow.stream.isCompressing}
            attachmentIntake="companion"
            onOpenNotebookMount={() => setNotebookMountOpen(true)}
            onSend={flow.handleSend}
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
            footer={composerFooter}
          />
        </div>
      </div>

      <WorkbenchNotebookMountDialog
        open={notebookMountOpen}
        sessionId={flow.sessionId}
        onClose={() => setNotebookMountOpen(false)}
      />

      {/* 对话框与抽屉弹出层组件 */}
      <AgentDialogs
        t={flow.t}
        i18n={flow.i18n}
        showCostDialog={flow.showCostDialog}
        setShowCostDialog={flow.setShowCostDialog}
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
        tokens={flow.tokens}
        assistants={flow.assistants}
        fetchAssistants={flow.fetchAssistants}
        shortcuts={flow.shortcuts}
        addShortcut={flow.addShortcut}
        updateShortcut={flow.updateShortcut}
        removeShortcut={flow.removeShortcut}
        recall={flow.recall}
        toolConfig={flow.toolConfig}
        pricingLastUpdated={flow.pricingLastUpdated}
        handleRefreshPricing={flow.handleRefreshPricing}
        currentAssistant={flow.currentAssistant}
        providers={flow.providers}
        inputBarRef={flow.inputBarRef}
        reasoningEffort={reasoningEffort}
        onReasoningEffortChange={handleReasoningEffortChange}
        reasoningControl={reasoningControl}
        modelReasoningPreviews={modelReasoningPreviews}
        modelMenuAnchorRect={modelMenuAnchor}
      />

      {flow.contextDialogState.flatEntries && (
        <ContextChainPanel
          key={flow.contextDialogState.message?.id ?? 'context-chain'}
          isOpen={flow.contextDialogState.isOpen}
          onClose={() =>
            flow.setContextDialogState((prev) => ({
              ...prev,
              isOpen: false
            }))
          }
          message={
            flow.contextDialogState.message ?? {
              id: '',
              sessionId: flow.sessionId || '',
              role: 'assistant',
              content: '',
              timestamp: new Date()
            }
          }
          flatEntries={flow.contextDialogState.flatEntries}
          meta={flow.contextDialogState.meta}
          compressedContent={flow.contextDialogState.compressedContent}
          systemPrompt={flow.contextDialogState.systemPrompt}
          sessionId={flow.contextDialogState.sessionId ?? flow.sessionId}
          onCompressionSummaryUpdated={(summaryText) => {
            flow.setContextDialogState((prev) => ({
              ...prev,
              compressedContent: summaryText,
              flatEntries: prev.flatEntries?.map((entry) =>
                entry.kind === 'compression-summary' ? { ...entry, summaryText } : entry
              )
            }))
          }}
          recompressBusy={flow.contextRecompressJob?.status === 'running'}
          recompressStartedAt={
            flow.contextRecompressJob?.status === 'running'
              ? flow.contextRecompressJob.startedAt
              : undefined
          }
          recompressStreamText={
            flow.stream.isCompressing && flow.stream.compressionPhase === 'manual'
              ? flow.stream.compressionText
              : ''
          }
          recompressStreamReasoning={
            flow.stream.isCompressing && flow.stream.compressionPhase === 'manual'
              ? flow.stream.compressionReasoning
              : ''
          }
          recompressError={
            flow.contextRecompressJob?.status === 'error' ? flow.contextRecompressJob.error : null
          }
          onRecompress={() => {
            const sid = flow.contextDialogState.sessionId ?? flow.sessionId
            if (sid) void flow.runContextRecompress(sid)
          }}
          onRecompressDismissError={flow.dismissContextRecompressError}
        />
      )}
    </div>
  )
}
