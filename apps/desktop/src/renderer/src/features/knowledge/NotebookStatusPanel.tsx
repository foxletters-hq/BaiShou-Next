import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Cloud,
  Database,
  Files,
  ScanText,
  Settings,
  Share2,
  Trash2,
  TriangleAlert
} from 'lucide-react'
import { Button } from '@baishou/ui'
import {
  buildNotebookOpenGuideRows,
  isNotebookStatusPickable,
  type NotebookOpenGuideRow,
  type NotebookStatusPickKey
} from './notebook-open-guide.util'
import type { KnowledgeOrganizeCompactStatus } from './knowledge-organize-compact.util'
import styles from './NotebookStatusPanel.module.css'

export type NotebookStatusPanelProps = {
  rows: NotebookOpenGuideRow[]
  busy?: boolean
  organizeStatus?: KnowledgeOrganizeCompactStatus | null
  onOpenSettings: () => void
  onOpenDataManage: () => void
  onOpenOrganize: () => void
  onDeleteNotebook: () => void
  onPickRow?: (key: NotebookStatusPickKey, anchor: DOMRect) => void
}

function StatusRowIcon({ row }: { row: NotebookOpenGuideRow }) {
  if (row.iconSrc) {
    return <img src={row.iconSrc} alt="" className={styles.iconImg} />
  }
  if (row.key === 'engine') return <ScanText size={16} />
  if (row.key === 'sources') return <Files size={16} />
  if (row.key === 'graph') return <Share2 size={16} />
  return <Cloud size={16} />
}

export const NotebookStatusPanel: React.FC<NotebookStatusPanelProps> = ({
  rows,
  busy = false,
  organizeStatus,
  onOpenSettings,
  onOpenDataManage,
  onOpenOrganize,
  onDeleteNotebook,
  onPickRow
}) => {
  const { t } = useTranslation()
  const displayRows = rows.length > 0 ? rows : buildNotebookOpenGuideRows({ sourceCount: 0 })
  const organizeCard = organizeStatus ? (
    <button
      type="button"
      className={`${styles.item} ${styles.itemAction} ${
        organizeStatus.failed ? styles.itemWarn : ''
      }`.trim()}
      aria-label={`${t('knowledge.organize_status', '整理状态')} ${organizeStatus.label}`}
      onClick={onOpenOrganize}
    >
      <span className={styles.icon} aria-hidden>
        {organizeStatus.running ? (
          <span className={styles.statusSpinner} />
        ) : (
          <TriangleAlert size={16} />
        )}
      </span>
      <span className={styles.meta}>
        <span className={styles.itemLabel}>{t('knowledge.organize_status', '整理状态')}</span>
        <span className={styles.itemValue}>{organizeStatus.label}</span>
      </span>
    </button>
  ) : null

  return (
    <section
      className={styles.strip}
      aria-label={t('knowledge.status_panel_title', '当前模型与抽取状态')}
    >
      <div className={styles.grid}>
        {displayRows.map((row) => {
          const pickable = Boolean(onPickRow && isNotebookStatusPickable(row.key))
          const itemClass = `${styles.item} ${row.warn ? styles.itemWarn : ''}`.trim()
          const body = (
            <>
              <span className={styles.icon} aria-hidden>
                <StatusRowIcon row={row} />
              </span>
              <span className={styles.meta}>
                <span className={styles.itemLabel}>{row.label}</span>
                <span className={styles.itemValue}>{row.value}</span>
              </span>
            </>
          )
          const rowNode = pickable ? (
            <button
              type="button"
              className={`${itemClass} ${styles.itemAction}`}
              aria-label={`${row.label} ${row.value}`}
              onClick={(event) => {
                onPickRow?.(
                  row.key as NotebookStatusPickKey,
                  event.currentTarget.getBoundingClientRect()
                )
              }}
            >
              {body}
            </button>
          ) : (
            <div className={itemClass}>{body}</div>
          )
          return (
            <React.Fragment key={row.key}>
              {rowNode}
              {row.key === 'sources' ? organizeCard : null}
            </React.Fragment>
          )
        })}
      </div>
      <div className={styles.actions}>
        <Button
          type="button"
          variant="outlined"
          className={styles.actionBtn}
          disabled={busy}
          onClick={onOpenSettings}
        >
          <Settings size={15} />
          {t('knowledge.notebook_manage', '笔记本管理')}
        </Button>
        <Button
          type="button"
          variant="outlined"
          className={styles.actionBtn}
          disabled={busy}
          onClick={onOpenDataManage}
        >
          <Database size={15} />
          {t('knowledge.data_manage', '数据管理')}
        </Button>
        <Button
          type="button"
          variant="outlined"
          className={`${styles.actionBtn} ${styles.actionDanger}`}
          disabled={busy}
          onClick={onDeleteNotebook}
        >
          <Trash2 size={15} />
          {t('knowledge.delete_notebook', '删除笔记本')}
        </Button>
      </div>
    </section>
  )
}
