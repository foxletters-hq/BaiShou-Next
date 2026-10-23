import i18n from 'i18next'
import React from 'react'
import { createPortal } from 'react-dom'
import { ListTree } from 'lucide-react'
import type { MockChatMessage } from '@baishou/shared'
import { CONTEXT_CHAIN_HEADER_ICON_SIZE } from '../../shared/icons/icon-sizes'
import { withAppContentOverlay } from '../overlay'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { ContextChainCompressionHelpButton } from './ContextChainCompressionHelpButton'
import {
  useContextChainView,
  COMPRESSION_SUMMARY_SELECTION_KEY,
  type CallChainFlatEntry,
  type CallChainPanelMeta
} from './useContextChainView'
import { usePanelTransition } from './usePanelTransition'
import { usePanelResize } from './usePanelResize'
import { RoundUsageFooterStats } from './RoundUsageFooterStats'
import { hasTokenUsageStats } from '../../shared/token-usage-display'
import { ContextChainListPane } from './ContextChainListPane'
import { ContextChainDetailPane } from './ContextChainDetailPane'
import panelStyles from './ContextChainPanel.module.css'

export interface ContextChainPanelProps {
  isOpen: boolean
  onClose: () => void
  message: MockChatMessage
  flatEntries: CallChainFlatEntry[]
  meta?: CallChainPanelMeta
  compressedContent?: string
  systemPrompt?: string
  sessionId?: string
  onCompressionSummaryUpdated?: (summaryText: string) => void
  recompressBusy?: boolean
  recompressError?: string | null
  recompressStartedAt?: number
  recompressStreamText?: string
  recompressStreamReasoning?: string
  onRecompress?: () => void
  onRecompressDismissError?: () => void
}

export const ContextChainPanel: React.FC<ContextChainPanelProps> = ({
  isOpen,
  onClose,
  message,
  flatEntries,
  meta,
  compressedContent,
  systemPrompt,
  sessionId,
  onCompressionSummaryUpdated: _onCompressionSummaryUpdated,
  recompressBusy = false,
  recompressError = null,
  recompressStreamText = '',
  recompressStreamReasoning = '',
  onRecompress,
  onRecompressDismissError
}) => {
  const [liveCompressionSummary, setLiveCompressionSummary] = React.useState<string | undefined>()
  const [liveCompressionReasoning, setLiveCompressionReasoning] = React.useState<
    string | undefined
  >()

  React.useEffect(() => {
    if (isOpen && !recompressBusy) {
      setLiveCompressionSummary(undefined)
      setLiveCompressionReasoning(undefined)
    }
  }, [isOpen, message.id, recompressBusy])

  const effectiveCompressionSummary =
    liveCompressionSummary ??
    flatEntries.find((e) => e.kind === 'compression-summary')?.summaryText ??
    compressedContent ??
    ''
  const effectiveCompressionReasoning =
    liveCompressionReasoning ??
    flatEntries.find((e) => e.kind === 'compression-summary')?.reasoningText ??
    ''
  const transition = usePanelTransition(isOpen)
  const { width, onResizeStart } = usePanelResize()

  const panelActive = transition.mounted && transition.active

  const view = useContextChainView({
    message,
    flatEntries,
    meta,
    compressedContent,
    systemPrompt,
    isOpen
  })

  const compressionSelected =
    view.selectedMessageKey === COMPRESSION_SUMMARY_SELECTION_KEY &&
    Boolean(effectiveCompressionSummary?.trim())

  React.useEffect(() => {
    if (compressedContent?.trim()) {
      setLiveCompressionSummary(compressedContent)
    }
  }, [compressedContent])

  const roundHeaderRefs = React.useRef<Map<number, HTMLButtonElement>>(new Map())
  const listPaneRef = React.useRef<HTMLDivElement>(null)
  const listItemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  const detailContentRef = React.useRef<HTMLDivElement>(null)

  const detailScrollKey = compressionSelected ? 'compression' : view.selectedMessageKey

  React.useLayoutEffect(() => {
    if (!panelActive) return
    const pane = detailContentRef.current
    if (pane) pane.scrollTop = 0
  }, [panelActive, detailScrollKey])

  const scrollListItemToBottom = React.useCallback((key: string | null) => {
    const pane = listPaneRef.current
    const el = key ? listItemRefs.current.get(key) : undefined
    if (!pane || !el) return
    const targetTop = el.offsetTop + el.offsetHeight - pane.clientHeight + 8
    pane.scrollTop = Math.max(0, targetTop)
  }, [])

  React.useLayoutEffect(() => {
    if (!panelActive) return
    const activeRound = view.resolveDefaultActiveRound()
    const header = roundHeaderRefs.current.get(activeRound)
    const pane = listPaneRef.current
    if (header && pane) {
      const targetTop = header.offsetTop + header.offsetHeight - pane.clientHeight + 8
      pane.scrollTop = Math.max(0, targetTop)
    }
    // view 每轮都是新对象，只跟 resolveDefaultActiveRound 走
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelActive, view.resolveDefaultActiveRound])

  React.useLayoutEffect(() => {
    if (!panelActive || !view.selectedMessageKey || compressionSelected) return
    scrollListItemToBottom(view.selectedMessageKey)
  }, [panelActive, view.selectedMessageKey, compressionSelected, scrollListItemToBottom])

  React.useEffect(() => {
    if (!transition.mounted || !transition.active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [transition.mounted, transition.active, onClose])

  if (!transition.mounted) return null

  const messageCount = view.messageEntries.length

  return createPortal(
    <div className={withAppContentOverlay(panelStyles.shell)}>
      <div
        className={`${panelStyles.backdrop} ${transition.active ? panelStyles.backdropActive : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`${panelStyles.panel} ${transition.active ? panelStyles.panelActive : ''}`}
        style={{ width }}
        role="dialog"
        aria-label={view.t('agent.chat.full_call_chain', '完整调用链')}
      >
        <div
          className={panelStyles.resizeHandle}
          onMouseDown={onResizeStart}
          title={view.t('agent.chat.resize_panel', '拖动调整宽度')}
          aria-hidden
        />

        <div className={panelStyles.header}>
          <div className={panelStyles.titleRow}>
            <ListTree
              size={CONTEXT_CHAIN_HEADER_ICON_SIZE}
              className={panelStyles.icon}
              aria-hidden
            />
            <span className={panelStyles.title}>
              {view.t('agent.chat.full_call_chain', '完整调用链')}
            </span>
            <span className={panelStyles.badge}>{messageCount}</span>
          </div>
          <button
            type="button"
            className={panelStyles.closeBtn}
            onClick={onClose}
            aria-label={i18n.t(
              'auto.packages.ui.src.desktop.ContextChainPanel.ContextChainPanel.L261',
              '关闭'
            )}
          >
            ×
          </button>
        </div>

        {view.tabs.length > 1 && (
          <div className={panelStyles.tabsRow}>
            {view.tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${panelStyles.tabButton} ${view.activeTab === tab.key ? panelStyles.tabActive : ''}`}
                onClick={() => view.setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className={panelStyles.body}>
          {view.activeTab === 'context' && (
            <div className={panelStyles.splitBody}>
              <ContextChainListPane
                view={view}
                compressionSelected={compressionSelected}
                effectiveCompressionSummary={effectiveCompressionSummary}
                listPaneRef={listPaneRef}
                listItemRefs={listItemRefs}
                roundHeaderRefs={roundHeaderRefs}
              />
              <ContextChainDetailPane
                view={view}
                compressionSelected={compressionSelected}
                effectiveCompressionSummary={effectiveCompressionSummary}
                effectiveCompressionReasoning={effectiveCompressionReasoning}
                flatEntries={flatEntries}
                sessionId={sessionId}
                recompressBusy={recompressBusy}
                recompressError={recompressError}
                recompressStreamText={recompressStreamText}
                recompressStreamReasoning={recompressStreamReasoning}
                onRecompress={onRecompress}
                onRecompressDismissError={onRecompressDismissError}
                detailContentRef={detailContentRef}
              />
            </div>
          )}

          {view.activeTab === 'compressed' && view.compressedContent && (
            <div className={panelStyles.contentArea}>
              <AgentMarkdownRenderer content={view.compressedContent} />
            </div>
          )}

          {view.activeTab === 'prompt' && view.systemPrompt && (
            <div className={panelStyles.contentArea}>
              <AgentMarkdownRenderer content={view.systemPrompt} plainText />
            </div>
          )}
        </div>

        {(view.meta?.nextRequest || (view.roundUsage && hasTokenUsageStats(view.roundUsage))) && (
          <div className={panelStyles.panelFooter}>
            {view.meta?.nextRequest && (
              <div className={panelStyles.estimateBar}>
                <div className={panelStyles.estimateTitleRow}>
                  <span className={panelStyles.estimateTitle}>
                    {view.t('agent.chat.next_request_estimate', '下次请求预计')}
                  </span>
                  <ContextChainCompressionHelpButton size={14} />
                </div>
                <div className={panelStyles.footerRow}>
                  <span className={panelStyles.footerStat}>
                    {view.t('agent.chat.est_context_tokens', '上下文')}{' '}
                    {view.meta.nextRequest.estimatedInputTokens.toLocaleString()}{' '}
                    {view.t('agent.chat.tokens_unit', 'tokens')}
                  </span>
                  <span className={panelStyles.footerStat}>
                    {view.t('agent.chat.context_rounds', '上下文轮数')}{' '}
                    {view.meta.nextRequest.contextRoundCount} /{' '}
                    {view.formatRoundLimit(view.meta.nextRequest.contextRoundLimit)}
                  </span>
                </div>
              </div>
            )}
            {view.roundUsage && hasTokenUsageStats(view.roundUsage) && (
              <div className={panelStyles.footerBar}>
                <div className={panelStyles.footerTitle}>
                  {view.t('agent.chat.this_round_usage', '本轮消耗')}
                  {view.meta?.activeRoundIndex
                    ? ` · ${view.t('agent.chat.round_label', '第 {{n}} 轮', {
                        n: view.meta.activeRoundIndex
                      })}`
                    : ''}
                </div>
                <RoundUsageFooterStats
                  usage={view.roundUsage}
                  costText={view.costText}
                  className={panelStyles.footerRow}
                  statClassName={panelStyles.footerStat}
                />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>,
    document.body
  )
}
