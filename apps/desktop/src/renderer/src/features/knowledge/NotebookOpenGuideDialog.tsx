import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@baishou/ui'
import { KnowledgeDialog } from './KnowledgeDialog'
import {
  buildNotebookOpenGuideRows,
  type NotebookOpenGuideRow
} from './notebook-open-guide.util'
import styles from './KnowledgePage.module.css'

export interface NotebookOpenGuideDialogProps {
  open: boolean
  notebookName: string
  rows: NotebookOpenGuideRow[]
  onContinue: (dontAskAgain: boolean) => void
  onOpenSettings: () => void
  /** 点遮罩、Escape 或返回：离开笔记本，不记「知道了」 */
  onBack: () => void
}

export const NotebookOpenGuideDialog: React.FC<NotebookOpenGuideDialogProps> = ({
  open,
  notebookName,
  rows,
  onContinue,
  onOpenSettings,
  onBack
}) => {
  const { t } = useTranslation()
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    if (!open) return
    setDontAskAgain(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onBack])

  return (
    <KnowledgeDialog
      open={open}
      onClose={onBack}
      title={t('knowledge.open_guide_title', '打开笔记本')}
      aria-label={t('knowledge.open_guide_title', '打开笔记本')}
      className={styles.dialogSettings}
    >
      <p className={styles.guideHint}>
        {t(
          'knowledge.open_guide_hint',
          '打开时先确认当前模型和抽取状态。当前笔记本：{{name}}',
          { name: notebookName || t('knowledge.title', '知识库') }
        )}
      </p>
      <div className={styles.guideList}>
        {(rows.length > 0
          ? rows
          : buildNotebookOpenGuideRows({ sourceCount: 0, graphPending: 0 })
        ).map((row) => (
          <div key={row.key} className={styles.guideRow}>
            <span className={styles.guideLabel}>{row.label}</span>
            <span className={row.warn ? styles.guideValueWarn : styles.guideValue}>{row.value}</span>
          </div>
        ))}
      </div>
      <div className={styles.guideFooter}>
        <label
          className={`${styles.guideCheckboxRow} ${dontAskAgain ? styles.guideCheckboxRowChecked : ''}`}
        >
          <Checkbox
            checked={dontAskAgain}
            onChange={(event) => setDontAskAgain(event.target.checked)}
          />
          <span className={styles.guideCheckboxLabel}>
            {t('knowledge.open_guide_dont_ask', '不再提示')}
          </span>
        </label>
        <div className={styles.guideActions}>
          <button
            type="button"
            className={styles.dialogCancelBtn}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onBack()
            }}
          >
            {t('knowledge.back_to_list', '返回知识库')}
          </button>
          <button
            type="button"
            className={styles.dialogCancelBtn}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onOpenSettings()
            }}
          >
            {t('knowledge.open_guide_settings', '打开笔记本设置')}
          </button>
          <button
            type="button"
            className={styles.dialogCancelBtn}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onContinue(dontAskAgain)
            }}
          >
            {t('knowledge.open_guide_continue', '知道了，开始使用')}
          </button>
        </div>
      </div>
    </KnowledgeDialog>
  )
}
