import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KnowledgeDialog } from './KnowledgeDialog'
import {
  isNotebookHeavyConfirmReady,
  notebookHeavyConfirmSecondsLeft
} from './notebook-heavy-confirm.util'
import styles from './KnowledgePage.module.css'

export type KnowledgeHeavyConfirmKind =
  | 'rebuild-index'
  | 'rebuild-graph'
  | 'embed-source'
  | 'reembed-vector'
  | 'reembed-graph'

export interface KnowledgeHeavyConfirmDialogProps {
  open: boolean
  kind: KnowledgeHeavyConfirmKind | null
  sourceTitle?: string
  onCancel: () => void
  onConfirm: () => void
}

function heavyConfirmCopy(
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string,
  kind: KnowledgeHeavyConfirmKind | null,
  sourceTitle?: string
): { title: string; message: string } {
  const titleText = sourceTitle?.trim() || t('knowledge.this_source', '这份资料')
  if (kind === 'rebuild-graph') {
    return {
      title: t('knowledge.rebuild_graph', '重新抽取图谱'),
      message: t(
        'knowledge.rebuild_graph_confirm',
        '会按当前资料重新抽取笔记本内关系，可能耗时较长。人生关系图不会被改动。'
      )
    }
  }
  if (kind === 'embed-source') {
    return {
      title: t('knowledge.embed_source', '嵌入'),
      message: t(
        'knowledge.embed_source_confirm',
        '将提取「{{title}}」的正文，并写入向量和图数据。可能耗时较长。',
        { title: titleText }
      )
    }
  }
  if (kind === 'reembed-vector') {
    return {
      title: t('knowledge.reembed_vector_title', '重新嵌入向量'),
      message: t(
        'knowledge.reembed_vector_confirm',
        '将按当前嵌入模型重新写入「{{title}}」的向量索引，不会改动图数据。可能耗时较长。',
        { title: titleText }
      )
    }
  }
  if (kind === 'reembed-graph') {
    return {
      title: t('knowledge.reembed_graph_title', '重新抽取图数据'),
      message: t(
        'knowledge.reembed_graph_confirm',
        '将按当前对话模型重新抽取「{{title}}」的关系。会先按这份资料清掉已抽出的节点和关系，再写入新结果；不会改动向量索引。可能耗时较长。',
        { title: titleText }
      )
    }
  }
  return {
    title: t('knowledge.rebuild_index', '重建索引'),
    message: t(
      'knowledge.rebuild_index_confirm',
      '会按当前嵌入模型重建本笔记本的向量索引，可能耗时较长，且不会产生同步流量。'
    )
  }
}

export const KnowledgeHeavyConfirmDialog: React.FC<KnowledgeHeavyConfirmDialogProps> = ({
  open,
  kind,
  sourceTitle,
  onCancel,
  onConfirm
}) => {
  const { t } = useTranslation()
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!open) return
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [open, kind])

  const ready = startedAt > 0 && isNotebookHeavyConfirmReady(startedAt, now)
  const secondsLeft = startedAt > 0 ? notebookHeavyConfirmSecondsLeft(startedAt, now) : 3
  const { title, message } = heavyConfirmCopy(t, kind, sourceTitle)

  return (
    <KnowledgeDialog
      open={open}
      onClose={onCancel}
      title={title}
      aria-label={title}
      className={styles.dialogSettings}
    >
      <p className={styles.guideHint}>{message}</p>
      <div className={styles.guideActions}>
        <button type="button" className={styles.dialogCancelBtn} onClick={onCancel}>
          {t('common.cancel', '取消')}
        </button>
        <button
          type="button"
          className={styles.dialogConfirmBtn}
          disabled={!ready}
          onClick={onConfirm}
        >
          {ready
            ? t('common.confirm', '确认')
            : t('knowledge.heavy_confirm_button', '确认（{{seconds}}）', { seconds: secondsLeft })}
        </button>
      </div>
    </KnowledgeDialog>
  )
}
