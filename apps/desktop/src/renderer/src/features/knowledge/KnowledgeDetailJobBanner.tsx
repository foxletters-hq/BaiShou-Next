import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal } from '@baishou/ui'
import { parseKnowledgeGraphStepError } from '@baishou/shared'
import { knowledgeIngestUserMessage } from './knowledge-ingest-user-error.util'
import {
  knowledgeOrganizeCompactKind,
  type KnowledgeOrganizePhaseRow,
  type KnowledgeOrganizeProgressCopy
} from './notebook-job-progress.util'
import {
  knowledgeOrganizeDefaultSourceId,
  knowledgeOrganizeSourceSummary
} from './notebook-organize-source.util'
import styles from './KnowledgePage.module.css'

export type KnowledgeDetailJobProgressView = KnowledgeOrganizeProgressCopy

function phaseLabel(
  t: (key: string, fallback: string) => string,
  id: KnowledgeOrganizePhaseRow['id']
): string {
  if (id === 'extract') return t('knowledge.organize_phase_extract', '文本提取')
  if (id === 'embed') return t('knowledge.organize_phase_embed', '向量嵌入')
  if (id === 'graphNodes') return t('knowledge.organize_phase_graph_nodes', '节点向量')
  return t('knowledge.organize_phase_graph', '图谱抽取')
}

function phaseValue(
  t: (key: string, fallback: string, options?: Record<string, number>) => string,
  row: KnowledgeOrganizePhaseRow
): string {
  if (row.status === 'skipped') return t('settings.rag_phase_skipped', '无需补齐')
  if (row.status === 'pending') return t('settings.rag_phase_waiting', '等待中')
  if (row.status === 'failed') return t('knowledge.organize_phase_failed', '失败')
  if (row.status === 'running' && row.pageTotal && row.pageTo) {
    if (row.pageFrom && row.pageFrom !== row.pageTo) {
      return t('knowledge.organize_phase_page_range', '第 {{from}}–{{to}} / {{total}} 页', {
        from: row.pageFrom,
        to: row.pageTo,
        total: row.pageTotal
      })
    }
    return t('knowledge.organize_phase_page_of', '第 {{page}} / {{total}} 页', {
      page: row.pageTo,
      total: row.pageTotal
    })
  }
  if (row.status === 'done') {
    if (row.total > 0) {
      return t('settings.rag_phase_done_count', '已完成 {{completed}}/{{total}}', {
        completed: row.completed,
        total: row.total
      })
    }
    return t('knowledge.organize_phase_done', '已完成')
  }
  if (row.total > 0) return `${row.completed}/${row.total}`
  if (row.status === 'running' && row.completed > 0) {
    return t('knowledge.organize_phase_page', '第 {{completed}} 页', {
      completed: row.completed
    })
  }
  return t('knowledge.organize_phase_running', '进行中')
}

function organizeItemValue(
  t: (key: string, fallback: string, options?: Record<string, number>) => string,
  item: KnowledgeOrganizeProgressCopy['items'][number]
): string {
  const count =
    item.total > 0
      ? `${item.completed}/${item.total}`
      : item.completed > 0
        ? t('knowledge.organize_phase_page', '第 {{completed}} 页', { completed: item.completed })
        : t('knowledge.organize_phase_running', '进行中')
  if (item.activity === 'parse') return `${t('knowledge.organize_item_parse', '读取 PDF')} ${count}`
  if (item.activity === 'render') return `${t('knowledge.organize_item_render', '渲染页面')} ${count}`
  if (item.activity === 'recognize' || item.activity === 'vision') {
    return `${t('knowledge.organize_item_recognize', '识图')} ${count}`
  }
  return count
}

function phasePercent(row: KnowledgeOrganizePhaseRow): number {
  if (row.status === 'done') return 100
  if (row.status !== 'running' || row.total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((row.completed / row.total) * 100)))
}

function KnowledgeOrganizePhaseList({
  phases
}: {
  phases: KnowledgeOrganizePhaseRow[]
}) {
  const { t } = useTranslation()
  return (
    <ul className={styles.organizePhaseList}>
      {phases.map((row) => {
        const percent = phasePercent(row)
        return (
          <li
            key={row.id}
            className={`${styles.organizePhaseRow} ${
              row.status === 'running'
                ? styles.organizePhaseRowCurrent
                : row.status === 'failed'
                  ? styles.organizePhaseRowFailed
                  : row.status === 'skipped'
                    ? styles.organizePhaseRowMuted
                    : ''
            }`}
          >
            <span className={styles.organizePhaseLabel}>{phaseLabel(t, row.id)}</span>
            {row.status === 'running' || row.status === 'done' ? (
              <div className={styles.organizePhaseBar}>
                <div className={styles.organizePhaseBarFill} style={{ width: `${percent}%` }} />
              </div>
            ) : (
              <span className={styles.organizePhaseBarSpacer} />
            )}
            <span className={styles.organizePhaseValue}>{phaseValue(t, row)}</span>
          </li>
        )
      })}
    </ul>
  )
}

function sourceSummaryLabel(
  t: (key: string, fallback: string) => string,
  phases: KnowledgeOrganizePhaseRow[]
): string {
  const kind = knowledgeOrganizeSourceSummary(phases)
  if (kind === 'failed') return t('knowledge.organize_phase_failed', '失败')
  if (kind === 'extract') return t('knowledge.status_extracting', '正在提取文本')
  if (kind === 'embed') return t('knowledge.status_embedding', '正在建立索引')
  if (kind === 'graph') return t('knowledge.status_graph_organizing', '正在整理图谱')
  if (kind === 'graphNodes') {
    return t('knowledge.organize_phase_graph_nodes_running', '正在整理节点向量')
  }
  if (kind === 'queued') return t('settings.rag_phase_waiting', '等待中')
  return t('knowledge.organize_title', '正在整理')
}

export function KnowledgeDetailJobBanner({
  jobProgress,
  status,
  error,
  open,
  onOpenChange
}: {
  jobProgress: KnowledgeDetailJobProgressView
  status: string
  error: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const sourceRows = jobProgress.sourceRows ?? []
  const [openSourceId, setOpenSourceId] = useState<string | null>(
    knowledgeOrganizeDefaultSourceId(sourceRows)
  )
  useEffect(() => {
    setOpenSourceId((current) => knowledgeOrganizeDefaultSourceId(sourceRows, current))
  }, [sourceRows])
  const failedStep = parseKnowledgeGraphStepError(jobProgress.error)?.step ?? null
  const compactKind = knowledgeOrganizeCompactKind(jobProgress.phases, jobProgress.failed)
  const compactLabel = jobProgress.failed
    ? failedStep === 'node-embed'
      ? t('knowledge.organize_failed_graph_nodes', '节点向量失败')
      : failedStep === 'align'
        ? t('knowledge.organize_failed_graph_align', '图谱对齐失败')
        : failedStep === 'extract'
          ? t('knowledge.organize_failed_graph_extract', '图谱抽取失败')
          : t('knowledge.organize_failed', '抽取失败')
    : sourceRows.length > 1
      ? t('knowledge.organize_count', '正在整理 {{count}} 份资料', { count: sourceRows.length })
      : compactKind === 'graph'
        ? t('knowledge.status_graph_organizing', '正在整理图谱')
        : compactKind === 'graphNodes'
          ? t('knowledge.organize_phase_graph_nodes_running', '正在整理节点向量')
          : compactKind === 'embed'
            ? t('knowledge.status_embedding', '正在建立索引')
            : compactKind === 'extract'
              ? t('knowledge.status_extracting', '正在提取文本')
              : t('knowledge.organize_title', '正在整理')
  const title = jobProgress.failed
    ? jobProgress.currentTitle
      ? failedStep === 'node-embed'
        ? t('knowledge.organize_failed_graph_nodes_named', '「{{title}}」节点向量失败', {
            title: jobProgress.currentTitle
          })
        : failedStep === 'align'
          ? t('knowledge.organize_failed_graph_align_named', '「{{title}}」图谱对齐失败', {
              title: jobProgress.currentTitle
            })
          : failedStep === 'extract'
            ? t('knowledge.organize_failed_graph_extract_named', '「{{title}}」图谱抽取失败', {
                title: jobProgress.currentTitle
              })
            : t('knowledge.organize_failed_named', '「{{title}}」抽取失败', {
                title: jobProgress.currentTitle
              })
      : compactLabel
    : sourceRows.length > 1
      ? t('knowledge.organize_count', '正在整理 {{count}} 份资料', { count: sourceRows.length })
      : jobProgress.currentTitle
        ? t('knowledge.organize_current', '正在整理「{{title}}」', {
            title: jobProgress.currentTitle
          })
        : compactLabel
  const jobError = jobProgress.error
    ? knowledgeIngestUserMessage(jobProgress.error, t)
    : ''

  return (
    <>
      {jobProgress.visible ? (
        <Button
          type="button"
          size="small"
          className={styles.organizeCompact}
          aria-label={compactLabel}
          onClick={() => onOpenChange(true)}
        >
          {jobProgress.failed ? null : <span className={styles.organizeSpinner} aria-hidden />}
          {compactLabel}
        </Button>
      ) : null}
      <Modal
        isOpen={open && jobProgress.visible}
        onClose={() => onOpenChange(false)}
        closeOnOverlayClick
        animation="fade"
        title={title}
        className={styles.organizeModal}
      >
        {sourceRows.length > 0 ? (
          <ul className={styles.organizeSourceList}>
            {sourceRows.map((row) => {
              const expanded = row.sourceId === openSourceId
              return (
                <li
                  key={row.sourceId}
                  className={`${styles.organizeSourceItem} ${
                    expanded ? styles.organizeSourceItemOpen : ''
                  }`}
                >
                  <button
                    type="button"
                    className={styles.organizeSourceRow}
                    aria-expanded={expanded}
                    onClick={() => setOpenSourceId(row.sourceId)}
                  >
                    <span className={styles.organizeSourceTitle}>{row.title}</span>
                    <span className={styles.organizeSourceSummary}>
                      {sourceSummaryLabel(t, row.phases)}
                    </span>
                  </button>
                  {expanded ? (
                    <div className={styles.organizeSourcePhases}>
                      <KnowledgeOrganizePhaseList phases={row.phases} />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <KnowledgeOrganizePhaseList phases={jobProgress.phases} />
        )}
        {jobError ? <p className={styles.organizeError}>{jobError}</p> : null}
        {sourceRows.length === 0 && jobProgress.items.length > 0 ? (
          <ul className={styles.organizeItemList}>
            {jobProgress.items.map((item) => (
              <li key={item.sourceId} className={styles.organizeItem}>
                <span className={styles.organizeItemTitle}>{item.title}</span>
                <span className={styles.organizeItemValue}>
                  {organizeItemValue(t, item)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.organizeModalActions}>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {jobProgress.failed
              ? t('common.got_it', '知道了')
              : t('graph.queue_modal_minimize', '收起，继续整理')}
          </Button>
        </div>
      </Modal>
      {status && !jobProgress.visible ? <p className={styles.bannerStatus}>{status}</p> : null}
      {error ? <p className={styles.bannerError}>{knowledgeIngestUserMessage(error, t)}</p> : null}
    </>
  )
}
