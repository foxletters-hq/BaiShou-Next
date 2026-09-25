import React from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Plus } from 'lucide-react'
import { HelpTooltip, Tooltip } from '@baishou/ui'
import { KnowledgeSourceFileIcon } from './KnowledgeSourceFileIcon'
import { knowledgeSourceStatusLabel } from './knowledge-detail-labels.util'
import { knowledgeIngestProgressLabel } from './knowledge-ingest-progress-label.util'
import { knowledgeIngestUserMessage } from './knowledge-ingest-user-error.util'
import {
  knowledgeSourceDisplayStatus,
  knowledgeSourceShowsPendingOrganizeHelp
} from './knowledge-source-status.util'
import {
  pickSourceCardEvidence,
  sourceCardFailureReason,
  sourceMissingPageCount
} from './source-card-evidence.util'
import type {
  KnowledgeOcrProgressState,
  KnowledgeSourceRow,
  KnowledgeUploadingSource
} from './knowledge-detail.types'
import styles from './KnowledgePage.module.css'

export function KnowledgeUploadingCard({
  item,
  onDismiss
}: {
  item: KnowledgeUploadingSource
  onDismiss: (localId: string) => void
}) {
  const { t } = useTranslation()
  const failed = Boolean(item.error)
  return (
    <li className={styles.sourceCardItem}>
      <div className={`${styles.notebookCard} ${styles.sourceCard}`}>
        <div className={styles.notebookCardTop} />
        <div className={styles.notebookCardVisual}>
          <span className={styles.sourceCardIcon} aria-hidden>
            <KnowledgeSourceFileIcon kind="file" fileName={item.fileName} size={28} />
          </span>
        </div>
        <div className={styles.notebookCardBody}>
          <h2 className={styles.notebookCardTitle}>{item.fileName}</h2>
          <p className={styles.notebookCardMeta}>
            {failed
              ? t('knowledge.status_upload_failed', '上传失败')
              : t('knowledge.status_uploading', '上传中 {{progress}}%', {
                  progress: Math.round(item.progress)
                })}
          </p>
          {failed ? <span className={styles.sourceEvidence}>{item.error}</span> : null}
          <div
            className={`${styles.sourceProgressTrack}${failed ? ` ${styles.sourceProgressFailed}` : ''}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(item.progress)}
          >
            <div
              className={styles.sourceProgressFill}
              style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
            />
          </div>
          {failed ? (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => onDismiss(item.localId)}
            >
              {t('knowledge.dismiss_upload', '关闭')}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
}

export function KnowledgeSourceCard({
  source,
  ocrProgress,
  graphJobStatus,
  onPreview,
  onOpenMenu
}: {
  source: KnowledgeSourceRow
  ocrProgress?: KnowledgeOcrProgressState
  graphJobStatus?: string | null
  onPreview: (source: KnowledgeSourceRow) => void
  onOpenMenu: (source: KnowledgeSourceRow, x: number, y: number) => void
}) {
  const { t } = useTranslation()
  const missingPages = sourceMissingPageCount(source)
  const displayStatus = knowledgeSourceDisplayStatus(source.status, graphJobStatus)
  const statusText =
    knowledgeIngestProgressLabel(t, ocrProgress) || knowledgeSourceStatusLabel(t, displayStatus)
  const pageProgress =
    ocrProgress && ocrProgress.total > 0
      ? Math.max(2, Math.round((Math.max(ocrProgress.page, 0) / ocrProgress.total) * 100))
      : source.status === 'embedding'
        ? 2
        : null
  const evidence = pickSourceCardEvidence({
    pageCount: source.pageCount,
    missingPages,
    hideHints: Boolean(ocrProgress)
  })
  const failureReason = sourceCardFailureReason({
    status: source.status,
    errorMessage: source.errorMessage
  })
  const card = (
    <div
      className={`${styles.notebookCard} ${styles.sourceCard}`}
      role="button"
      tabIndex={0}
      aria-label={
        failureReason
          ? `${source.title} ${statusText}。${knowledgeIngestUserMessage(failureReason, t)}`
          : undefined
      }
      onClick={() => void onPreview(source)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void onPreview(source)
        }
      }}
    >
      <div className={styles.notebookCardTop}>
        <span aria-hidden />
        <button
          type="button"
          className={styles.notebookCardMenu}
          aria-label={t('knowledge.source_menu', '资料操作')}
          title={t('knowledge.source_menu', '资料操作')}
          onClick={(event) => {
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            onOpenMenu(source, rect.right, rect.bottom)
          }}
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </button>
      </div>
      <div className={styles.notebookCardVisual}>
        <span className={styles.sourceCardIcon} aria-hidden>
          <KnowledgeSourceFileIcon kind={source.sourceKind} fileName={source.title} size={28} />
        </span>
      </div>
      <div className={styles.notebookCardBody}>
        <h2 className={styles.notebookCardTitle}>{source.title}</h2>
        <p
          className={
            knowledgeSourceShowsPendingOrganizeHelp(source.status)
              ? `${styles.notebookCardMeta} ${styles.sourceCardStatus}`
              : styles.notebookCardMeta
          }
        >
          <span>{statusText}</span>
          {knowledgeSourceShowsPendingOrganizeHelp(source.status) ? (
            <HelpTooltip
              content={t('knowledge.status_stored_help', '未整理之前，AI 无法使用这份资料。')}
            />
          ) : null}
        </p>
        {pageProgress != null ? (
          <div
            className={styles.sourceProgressTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pageProgress}
          >
            <div className={styles.sourceProgressFill} style={{ width: `${pageProgress}%` }} />
          </div>
        ) : null}
        {evidence?.type === 'scan' ? (
          <span className={styles.sourceEvidence}>
            {t('knowledge.scan_evidence', '{{total}} 页中 {{missing}} 页无文本层', {
              total: evidence.pageCount,
              missing: evidence.missingPages
            })}
          </span>
        ) : null}
      </div>
    </div>
  )
  return (
    <li className={styles.sourceCardItem}>
      {failureReason ? (
        <Tooltip
          content={knowledgeIngestUserMessage(failureReason, t)}
          className={styles.sourceCardFailWrap}
          tooltipClassName={styles.sourceFailTooltip}
        >
          {card}
        </Tooltip>
      ) : (
        card
      )}
    </li>
  )
}

export function KnowledgeSourcesColumn({
  busy,
  sourcesLoaded,
  sources,
  uploadingSources,
  ocrProgressBySource,
  graphJobStatusBySource,
  onAddSource,
  onPreview,
  onOpenMenu,
  onDismissUpload
}: {
  busy: boolean
  sourcesLoaded: boolean
  sources: KnowledgeSourceRow[]
  uploadingSources: KnowledgeUploadingSource[]
  ocrProgressBySource: Record<string, KnowledgeOcrProgressState>
  graphJobStatusBySource?: Record<string, string>
  onAddSource: () => void
  onPreview: (source: KnowledgeSourceRow) => void
  onOpenMenu: (source: KnowledgeSourceRow, x: number, y: number) => void
  onDismissUpload: (localId: string) => void
}) {
  const { t } = useTranslation()
  return (
    <section
      id="knowledge-sources-panel"
      className={styles.sourcesBody}
      aria-label={t('knowledge.sources_panel', '来源')}
    >
      <div className={styles.columnHead}>
        <h2 className={styles.columnTitle}>{t('knowledge.sources_panel', '来源')}</h2>
      </div>
      <ul className={`${styles.listGrid} ${styles.sourceGrid}`}>
        <li className={styles.sourceCardItem}>
          <button type="button" className={styles.createCard} onClick={onAddSource} disabled={busy}>
            <span className={styles.createCardIcon} aria-hidden>
              <Plus size={22} strokeWidth={2.25} />
            </span>
            <span className={styles.createCardLabel}>{t('knowledge.add_source', '添加来源')}</span>
          </button>
        </li>
        {uploadingSources.map((item) => (
          <KnowledgeUploadingCard key={item.localId} item={item} onDismiss={onDismissUpload} />
        ))}
        {(sourcesLoaded ? sources : []).map((source) => (
          <KnowledgeSourceCard
            key={source.id}
            source={source}
            ocrProgress={ocrProgressBySource[source.id]}
            graphJobStatus={graphJobStatusBySource?.[source.id]}
            onPreview={onPreview}
            onOpenMenu={onOpenMenu}
          />
        ))}
      </ul>
    </section>
  )
}
