import i18n from 'i18next'
import React from 'react'
import type { CallChainFlatEntry } from './useContextChainView'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { ContextChainRecompressBar } from './ContextChainRecompressBar'
import { CompressionActivityBar } from '../CompressionActivityBar'
import { ContextChainAttachments } from './ContextChainAttachments'
import panelStyles from './ContextChainPanel.module.css'

type ChainView = ReturnType<typeof import('./useContextChainView').useContextChainView>

export function ContextChainDetailPane(props: {
  view: ChainView
  compressionSelected: boolean
  effectiveCompressionSummary: string
  effectiveCompressionReasoning: string
  flatEntries: CallChainFlatEntry[]
  sessionId?: string
  recompressBusy: boolean
  recompressError?: string | null
  recompressStreamText: string
  recompressStreamReasoning: string
  onRecompress?: () => void
  onRecompressDismissError?: () => void
  detailContentRef: React.RefObject<HTMLDivElement | null>
}) {
  const { view } = props

  return (
    <div className={panelStyles.detailPane}>
      {props.compressionSelected ? (
        <>
          <div className={panelStyles.detailHeader}>
            <div className={panelStyles.detailHeaderRow}>
              <span className={`${panelStyles.msgRole} ${panelStyles.roleCompaction}`}>
                {view.t('agent.chat.compaction_summary', '对话压缩')}
              </span>
              {props.sessionId && props.onRecompress && (
                <ContextChainRecompressBar
                  busy={props.recompressBusy}
                  error={props.recompressError}
                  onRecompress={props.onRecompress}
                  onDismissError={props.onRecompressDismissError}
                />
              )}
            </div>
          </div>
          <div className={panelStyles.detailContent} ref={props.detailContentRef}>
            {props.recompressBusy ? (
              <CompressionActivityBar
                phase="manual"
                embedded
                summary={props.recompressStreamText}
                reasoning={props.recompressStreamReasoning}
                isActive
              />
            ) : (
              <CompressionActivityBar
                phase="auto"
                embedded
                summary={props.effectiveCompressionSummary}
                reasoning={props.effectiveCompressionReasoning}
                isActive={false}
                thoughtDurationMs={
                  props.flatEntries.find((e) => e.kind === 'compression-summary')?.thoughtDurationMs
                }
                summaryDurationMs={
                  props.flatEntries.find((e) => e.kind === 'compression-summary')?.summaryDurationMs
                }
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
          <div className={panelStyles.detailContent} ref={props.detailContentRef}>
            {view.selected.attachments && view.selected.attachments.length > 0 && (
              <ContextChainAttachments attachments={view.selected.attachments} />
            )}
            {view.selected.content ? (
              <AgentMarkdownRenderer
                content={view.selected.content}
                plainText={
                  view.selected.label ===
                  i18n.t(
                    'auto.packages.ui.src.desktop.ContextChainPanel.ContextChainPanel.L448',
                    '系统提示词'
                  )
                }
              />
            ) : !view.selected.attachments?.length ? (
              view.t('agent.chat.no_content', '[无内容]')
            ) : null}
          </div>
        </>
      ) : (
        <div className={panelStyles.detailPlaceholder}>
          {view.t('agent.chat.select_chain_item', '在左侧选择一条消息，查看发送给 AI 的完整内容')}
        </div>
      )}
    </div>
  )
}
