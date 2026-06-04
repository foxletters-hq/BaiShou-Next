import React from 'react'
import type { MockChatMessage } from '@baishou/shared'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ContextChainCompressionHelpButton } from './ContextChainCompressionHelpButton'
import {
  useContextChainView,
  COMPRESSION_SUMMARY_SELECTION_KEY,
  type CallChainFlatEntry,
  type CallChainPanelMeta
} from './useContextChainView'
import { usePanelTransition } from './usePanelTransition'
import { usePanelResize } from './usePanelResize'
import { ContextChainRecompressBar } from './ContextChainRecompressBar'
import { CompressionActivityBar } from '../CompressionActivityBar'
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
  onCompressionSummaryUpdated,
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

  // 选中条目后详情区从顶部开始展示（而非滚到底部）
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

  const renderMetaChip = (opts: {
    label: string
    badgeClass: string
    itemClass: string
    selected: boolean
    onSelect: () => void
    key: string
  }) => (
    <div
      key={opts.key}
      role="button"
      tabIndex={0}
      className={`${panelStyles.metaChip} ${opts.itemClass} ${
        opts.selected ? panelStyles.metaChipSelected : ''
      }`}
      onClick={opts.onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          opts.onSelect()
        }
      }}
    >
      <span className={`${panelStyles.msgRole} ${opts.badgeClass}`}>{opts.label}</span>
    </div>
  )

  const hasSystemPromptCard = Boolean(view.systemPromptEntry?.item)
  const hasCompressionCard = Boolean(effectiveCompressionSummary?.trim())
  const systemPromptId = view.systemPromptEntry?.item?.id ?? null

  const renderChainMessage = (entry: (typeof view.messageEntries)[number], idx: number) => {
    if (!entry.item) return null
    const msg = entry.item
    const selected = view.selectedMessageKey === msg.id
    const label = view.getMessageLabel(msg)
    const isSystemPrompt = entry.kind === 'system-prompt' || msg.label === '系统提示词'

    const itemKey = msg.id ?? `msg-${idx}`

    return (
      <div
        key={itemKey}
        ref={(el) => {
          if (el && msg.id) listItemRefs.current.set(msg.id, el)
          else if (msg.id) listItemRefs.current.delete(msg.id)
        }}
        className={`${panelStyles.messageItem} ${
          selected ? panelStyles.messageItemSelected : ''
        } ${isSystemPrompt ? panelStyles.messageItemSystem : ''}`}
        onClick={() => view.setSelectedMessageKey(msg.id ?? null)}
      >
        <span className={`${panelStyles.msgRole} ${view.getLabelBadgeClass(msg.label)}`}>
          {label}
        </span>
        <div className={panelStyles.msgPreview}>
          {msg.label === '工具调用'
            ? view.formatToolPreview(msg.content)
            : msg.content
              ? view.formatPreview(msg.content)
              : view.t('agent.chat.empty_content', '[空文本]')}
        </div>
      </div>
    )
  }

  return (
    <>
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
            <span className={panelStyles.icon}>🌿</span>
            <span className={panelStyles.title}>
              {view.t('agent.chat.full_call_chain', '完整调用链')}
            </span>
            <span className={panelStyles.badge}>{messageCount}</span>
          </div>
          <button
            type="button"
            className={panelStyles.closeBtn}
            onClick={onClose}
            aria-label="关闭"
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
              <div className={panelStyles.listPane} ref={listPaneRef}>
                {view.flatEntries.length === 0 ? (
                  <div className={panelStyles.emptyHint}>
                    {view.t('agent.chat.no_context_messages', '暂无发送给 AI 的上下文记录')}
                  </div>
                ) : (
                  <>
                    {(hasSystemPromptCard || hasCompressionCard) && (
                      <div className={panelStyles.metaRow}>
                        {hasSystemPromptCard &&
                          renderMetaChip({
                            key: 'chain-system-prompt',
                            label: view.getMessageLabel(view.systemPromptEntry!.item!),
                            badgeClass: panelStyles.roleSystem,
                            itemClass: panelStyles.messageItemSystem,
                            selected: Boolean(
                              systemPromptId && view.selectedMessageKey === systemPromptId
                            ),
                            onSelect: () => view.setSelectedMessageKey(systemPromptId)
                          })}
                        {hasCompressionCard &&
                          renderMetaChip({
                            key: 'chain-compression',
                            label: view.t('agent.chat.compaction_summary', '对话压缩'),
                            badgeClass: panelStyles.roleCompaction,
                            itemClass: panelStyles.messageItemCompression,
                            selected: compressionSelected,
                            onSelect: () =>
                              view.setSelectedMessageKey(COMPRESSION_SUMMARY_SELECTION_KEY)
                          })}
                      </div>
                    )}
                    {hasCompressionCard && (
                      <p className={panelStyles.compressionListHint}>
                        {view.t(
                          'agent.chat.compaction_between_rounds',
                          '已压缩更早轮次，以下从第 1 轮重新计数'
                        )}
                      </p>
                    )}
                    {hasCompressionCard && view.roundGroups.length > 0 && (
                      <hr className={panelStyles.chainMetaDivider} aria-hidden />
                    )}
                    {view.roundGroups.map((group) => {
                      const expanded = view.isRoundExpanded(group.roundIndex)
                      const isActiveRound =
                        group.roundIndex ===
                        (view.meta?.activeRoundIndex ?? view.resolveDefaultActiveRound())
                      const visibleMessages = view.getVisibleMessages(group)

                      return (
                        <div key={`round-wrap-${group.roundIndex}`}>
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) roundHeaderRefs.current.set(group.roundIndex, el)
                              else roundHeaderRefs.current.delete(group.roundIndex)
                            }}
                            className={`${panelStyles.roundHeaderBtn} ${
                              isActiveRound ? panelStyles.roundHeaderActive : ''
                            }`}
                            onClick={() => view.toggleRound(group.roundIndex)}
                            aria-expanded={expanded}
                          >
                            <span
                              className={`${panelStyles.roundChevron} ${
                                expanded ? panelStyles.roundChevronExpanded : ''
                              }`}
                              aria-hidden
                            >
                              ▶
                            </span>
                            <span className={panelStyles.roundHeaderLabel}>
                              {view.t('agent.chat.round_label', '第 {{n}} 轮', {
                                n: group.roundIndex
                              })}
                              {isActiveRound
                                ? `（${view.t('agent.chat.current_round', '当前')}）`
                                : ''}
                            </span>
                            <span className={panelStyles.roundHeaderMeta}>
                              {group.messages.length}
                              {view.t('agent.chat.round_items', ' 条')}
                            </span>
                          </button>
                          {expanded && (
                            <div className={panelStyles.roundBody}>
                              <div className={panelStyles.roundBodyInner}>
                                {visibleMessages.map((entry, idx) =>
                                  renderChainMessage(entry, idx)
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>

              <div className={panelStyles.detailPane}>
                {compressionSelected ? (
                  <>
                    <div className={panelStyles.detailHeader}>
                      <div className={panelStyles.detailHeaderRow}>
                        <span className={`${panelStyles.msgRole} ${panelStyles.roleCompaction}`}>
                          {view.t('agent.chat.compaction_summary', '对话压缩')}
                        </span>
                        {sessionId && onRecompress && (
                          <ContextChainRecompressBar
                            busy={recompressBusy}
                            error={recompressError}
                            onRecompress={onRecompress}
                            onDismissError={onRecompressDismissError}
                          />
                        )}
                      </div>
                    </div>
                    <div className={panelStyles.detailContent} ref={detailContentRef}>
                      {recompressBusy ? (
                        <CompressionActivityBar
                          phase="manual"
                          embedded
                          summary={recompressStreamText}
                          reasoning={recompressStreamReasoning}
                          isActive
                        />
                      ) : (
                        <CompressionActivityBar
                          phase="auto"
                          embedded
                          summary={effectiveCompressionSummary}
                          reasoning={effectiveCompressionReasoning}
                          isActive={false}
                          thoughtDurationMs={flatEntries.find((e) => e.kind === 'compression-summary')?.thoughtDurationMs}
                          summaryDurationMs={flatEntries.find((e) => e.kind === 'compression-summary')?.summaryDurationMs}
                        />
                      )}
                    </div>
                  </>
                ) : view.selected ? (
                  <>
                    <div className={panelStyles.detailHeader}>
                      <span
                        className={`${panelStyles.msgRole} ${view.getLabelBadgeClass(view.selected.label)}`}
                      >
                        {view.getMessageLabel(view.selected)}
                      </span>
                    </div>
                    <div className={panelStyles.detailContent} ref={detailContentRef}>
                      {view.selected.content ? (
                        <MarkdownRenderer
                          content={view.selected.content}
                          plainText={view.selected.label === '系统提示词'}
                        />
                      ) : (
                        view.t('agent.chat.no_content', '[无内容]')
                      )}
                    </div>
                  </>
                ) : (
                  <div className={panelStyles.detailPlaceholder}>
                    {view.t(
                      'agent.chat.select_chain_item',
                      '在左侧选择一条消息，查看发送给 AI 的完整内容'
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {view.activeTab === 'compressed' && view.compressedContent && (
            <div className={panelStyles.contentArea}>
              <MarkdownRenderer content={view.compressedContent} />
            </div>
          )}

          {view.activeTab === 'prompt' && view.systemPrompt && (
            <div className={panelStyles.contentArea}>
              <MarkdownRenderer content={view.systemPrompt} plainText />
            </div>
          )}
        </div>

        {(view.meta?.nextRequest ||
          (view.roundUsage &&
            (view.roundUsage.inputTokens > 0 ||
              view.roundUsage.outputTokens > 0 ||
              view.roundUsage.costMicros > 0))) && (
          <div className={panelStyles.panelFooter}>
            {view.meta?.nextRequest && (
              <div className={panelStyles.estimateBar}>
                <div className={panelStyles.estimateTitleRow}>
                  <span className={panelStyles.estimateTitle}>
                    {view.t('agent.chat.next_request_estimate', '下次请求预计')}
                  </span>
                  <ContextChainCompressionHelpButton size={15} />
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
            {view.roundUsage &&
              (view.roundUsage.inputTokens > 0 ||
                view.roundUsage.outputTokens > 0 ||
                view.roundUsage.costMicros > 0) && (
                <div className={panelStyles.footerBar}>
                  <div className={panelStyles.footerTitle}>
                    {view.t('agent.chat.this_round_usage', '本轮消耗')}
                    {view.meta?.activeRoundIndex
                      ? ` · ${view.t('agent.chat.round_label', '第 {{n}} 轮', {
                          n: view.meta.activeRoundIndex
                        })}`
                      : ''}
                  </div>
                  <div className={panelStyles.footerRow}>
                    <span className={panelStyles.footerStat}>
                      <span className={panelStyles.footerStatIcon}>↑</span>
                      {view.t('agent.chat.round_input', '上行')}{' '}
                      {view.roundUsage.inputTokens.toLocaleString()} tokens
                    </span>
                    <span className={panelStyles.footerStat}>
                      <span className={panelStyles.footerStatIcon}>↓</span>
                      {view.t('agent.chat.round_output', '下行')}{' '}
                      {view.roundUsage.outputTokens.toLocaleString()} tokens
                    </span>
                    {view.costText && (
                      <span className={panelStyles.footerStat}>
                        <span className={panelStyles.footerStatIcon}>$</span>
                        {view.t('agent.chat.round_cost', '费用')} {view.costText}
                      </span>
                    )}
                  </div>
                </div>
              )}
          </div>
        )}
      </aside>
    </>
  )
}
