import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@baishou/ui'
import { isNotebookHeavyConfirmReady, notebookHeavyConfirmSecondsLeft } from '@baishou/shared'
import { KnowledgeDialog } from './KnowledgeDialog'
import styles from './KnowledgePage.module.css'

export function KnowledgeDeleteNotebookDialog(props: {
  open: boolean
  notebookName: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (!props.open) return
    const start = Date.now()
    setStartedAt(start)
    setNow(start)
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [props.open, props.notebookName])

  const ready = startedAt > 0 && isNotebookHeavyConfirmReady(startedAt, now)
  const secondsLeft = notebookHeavyConfirmSecondsLeft(startedAt || now, now)
  const title = t('knowledge.delete_notebook_title', '删除笔记本')

  return (
    <KnowledgeDialog
      open={props.open}
      onClose={props.busy ? () => undefined : props.onCancel}
      closeDisabled={props.busy}
      title={title}
      aria-label={title}
      className={styles.dialogSettings}
    >
      <p className={styles.guideHint}>
        {t(
          'knowledge.delete_notebook_confirm',
          '将删除「{{name}}」及其全部资料、抽出正文、向量和本笔记本图谱。仓里的真源会一并去掉，同步后其他设备也会清掉。此操作不能恢复。',
          { name: props.notebookName }
        )}
      </p>
      <div className={styles.guideActions}>
        <Button type="button" onClick={props.onCancel} disabled={props.busy}>
          {t('common.cancel', '取消')}
        </Button>
        <Button type="button" disabled={!ready || props.busy} onClick={props.onConfirm}>
          {ready
            ? t('knowledge.delete_notebook', '删除笔记本')
            : t('knowledge.heavy_confirm_button', '确认（{{seconds}}）', { seconds: secondsLeft })}
        </Button>
      </div>
    </KnowledgeDialog>
  )
}
