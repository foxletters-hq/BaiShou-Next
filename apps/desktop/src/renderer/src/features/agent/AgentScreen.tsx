import React, { useMemo } from 'react'
import {
  TokenBadge,
  InputBar,
  ContextChainPanel,
  useTheme,
  getProviderIcon,
  toast
} from '@baishou/ui'
import { createWebComposerDraftStorage } from '@baishou/ui/shared/composer-draft'
import { MdAutoAwesome, MdCloud } from 'react-icons/md'
import {
  normalizeChatBackgroundBlur,
  normalizeChatBackgroundOverlayOpacity,
  isConfiguredDialogueModelId,
  isConfiguredProviderId
} from '@baishou/shared'
import { AgentDialogs } from './components/AgentDialogs'
import { AgentMessageList } from './components/AgentMessageList'
import { useAgentChatFlow } from './hooks/useAgentChatFlow'
import { useDesktopComposerDraftKey } from './hooks/useDesktopComposerDraftKey'
import styles from './AgentScreen.module.css'

/**
 * Agent 大模型聊天屏幕主页面组件。
 * 本组件已彻底重构为容器组件，仅负责高层框架布局，业务逻辑与渲染控制已分别下沉至 useAgentChatFlow 和子组件中。
 */
export const AgentScreen: React.FC = () => {
  const flow = useAgentChatFlow()
  const { isDark } = useTheme()

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

  const displayModelName = noModelSelected
    ? flow.t('agent.no_model_selected', '暂未选择模型')
    : flow.model.currentModelId

  const composerDraftStorage = useMemo(() => createWebComposerDraftStorage(), [])
  const composerDraftKey = useDesktopComposerDraftKey(flow.sessionId)
  const composerBlocked =
    !isConfiguredProviderId(flow.model.currentProviderId) ||
    !isConfiguredDialogueModelId(flow.model.currentModelId)

  const chatBackgroundUrl = flow.userProfile?.chatBackgroundPath
  const chatBackgroundBlur = normalizeChatBackgroundBlur(flow.userProfile?.chatBackgroundBlur)
  const chatBackgroundOverlay = normalizeChatBackgroundOverlayOpacity(
    flow.userProfile?.chatBackgroundOverlayOpacity
  )

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
      {/* 顶部状态与控制栏 */}
      <div className={styles.appBar}>
        <button
          type="button"
          className={`${styles.modelSwitcherTrigger} ${styles.appBarChip}`}
          onClick={() => flow.setShowModelSwitcher(true)}
        >
          <span className={styles.modelProviderIcon} aria-hidden>
            {providerIconUrl ? (
              <img src={providerIconUrl} alt="" />
            ) : noModelSelected ? (
              <MdAutoAwesome size={18} />
            ) : (
              <MdCloud size={18} />
            )}
          </span>
          <span className={styles.modelName}>{displayModelName}</span>
          <span className={styles.chevron}>▼</span>
        </button>
        <TokenBadge
          className={styles.appBarChip}
          inputTokens={flow.tokens.totalInputTokens}
          outputTokens={flow.tokens.totalOutputTokens}
          costMicros={flow.tokens.estimatedCost * 1000000}
          onClick={() => flow.setShowCostDialog(true)}
        />
      </div>
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

      {/* 底部输入区；回到底部为悬浮单按钮，不占布局、不挡内容 */}
      <div className={styles.inputFooter}>
        <div className={styles.inputContainer}>
          {flow.scroll.showScrollButton && (
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
          )}
          <InputBar
            ref={flow.inputBarRef}
            isLoading={flow.stream.isStreaming || flow.stream.isCompressing}
            onSend={flow.handleSend}
            onStop={flow.handleStop}
            composerBlocked={composerBlocked}
            onComposerBlocked={() =>
              toast.showInfo(flow.t('agent.error.no_model', '请先在顶部选择一个模型'))
            }
            composerDraftKey={composerDraftKey}
            composerDraftStorage={composerDraftStorage}
            shortcuts={flow.shortcuts}
            assistantName={flow.currentAssistant?.name || 'BaiShou'}
            onAssistantTap={() => flow.setShowAssistantPicker(true)}
            onManageShortcuts={() => flow.setShowShortcutManager(true)}
            onRecall={() => flow.setShowRecallSheet(true)}
            onOpenTools={() => flow.setShowToolManager(true)}
            searchMode={flow.searchMode}
            onToggleSearchMode={flow.toggleSearchMode}
            ttsMode={flow.tts.ttsMode}
            onToggleTtsMode={flow.tts.toggleTtsMode}
          />
        </div>
      </div>
    </div>
  )
}
