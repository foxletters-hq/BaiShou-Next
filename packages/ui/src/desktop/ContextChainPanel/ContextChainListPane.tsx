import i18n from 'i18next'
import React from 'react'
import { ContextChainAttachments } from './ContextChainAttachments'
import { COMPRESSION_SUMMARY_SELECTION_KEY, type CallChainFlatEntry } from './useContextChainView'
import panelStyles from './ContextChainPanel.module.css'

type ChainView = ReturnType<typeof import('./useContextChainView').useContextChainView>

export function ContextChainListPane(props: {
  view: ChainView
  compressionSelected: boolean
  effectiveCompressionSummary: string
  listPaneRef: React.RefObject<HTMLDivElement | null>
  listItemRefs: React.MutableRefObject<Map<string, HTMLDivElement>>
  roundHeaderRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>
}) {
  const { view } = props
  const hasSystemPromptCard = Boolean(view.systemPromptEntry?.item)
  const hasCompressionCard = Boolean(props.effectiveCompressionSummary?.trim())
  const systemPromptId = view.systemPromptEntry?.item?.id ?? null

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

  const renderChainMessage = (entry: (typeof view.messageEntries)[number], idx: number) => {
    if (!entry.item) return null
    const msg = entry.item
    const selected = view.selectedMessageKey === msg.id
    const label = view.getMessageLabel(msg)
    const isSystemPrompt =
      entry.kind === 'system-prompt' ||
      msg.label ===
        i18n.t(
          'auto.packages.ui.src.desktop.ContextChainPanel.ContextChainPanel.L190',
          '系统提示词'
        )

    const itemKey = msg.id ?? `msg-${idx}`

    return (
      <div
        key={itemKey}
        ref={(el) => {
          if (el && msg.id) props.listItemRefs.current.set(msg.id, el)
          else if (msg.id) props.listItemRefs.current.delete(msg.id)
        }}
        className={`${panelStyles.messageItem} ${
          selected ? panelStyles.messageItemSelected : ''
        } ${isSystemPrompt ? panelStyles.messageItemSystem : ''}`}
        onClick={() => view.setSelectedMessageKey(msg.id ?? null)}
      >
        <span className={`${panelStyles.msgRole} ${view.getLabelBadgeClass(msg.label)}`}>
          {label}
        </span>
        {msg.attachments && msg.attachments.length > 0 && (
          <ContextChainAttachments attachments={msg.attachments} compact />
        )}
        <div className={panelStyles.msgPreview}>
          {msg.label ===
          i18n.t(
            'auto.packages.ui.src.desktop.ContextChainPanel.ContextChainPanel.L213',
            '工具调用'
          )
            ? view.formatToolPreview(msg.content)
            : msg.content
              ? view.formatPreview(msg.content)
              : !msg.attachments?.length
                ? view.t('agent.chat.empty_content', '[空文本]')
                : null}
        </div>
      </div>
    )
  }

  return (
    <div className={panelStyles.listPane} ref={props.listPaneRef}>
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
                  selected: Boolean(systemPromptId && view.selectedMessageKey === systemPromptId),
                  onSelect: () => view.setSelectedMessageKey(systemPromptId)
                })}
              {hasCompressionCard &&
                renderMetaChip({
                  key: 'chain-compression',
                  label: view.t('agent.chat.compaction_summary', '对话压缩'),
                  badgeClass: panelStyles.roleCompaction,
                  itemClass: panelStyles.messageItemCompression,
                  selected: props.compressionSelected,
                  onSelect: () => view.setSelectedMessageKey(COMPRESSION_SUMMARY_SELECTION_KEY)
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
              group.roundIndex === (view.meta?.activeRoundIndex ?? view.resolveDefaultActiveRound())
            const visibleMessages = view.getVisibleMessages(group)

            return (
              <div key={`round-wrap-${group.roundIndex}`}>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) props.roundHeaderRefs.current.set(group.roundIndex, el)
                    else props.roundHeaderRefs.current.delete(group.roundIndex)
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
                    {isActiveRound ? `（${view.t('agent.chat.current_round', '当前')}）` : ''}
                  </span>
                  <span className={panelStyles.roundHeaderMeta}>
                    {group.messages.length}
                    {view.t('agent.chat.round_items', ' 条')}
                  </span>
                </button>
                {expanded && (
                  <div className={panelStyles.roundBody}>
                    <div className={panelStyles.roundBodyInner}>
                      {visibleMessages.map((entry, idx) => renderChainMessage(entry, idx))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

export type { CallChainFlatEntry }
