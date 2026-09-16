import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Checkbox, Input, Modal, SegmentedControl } from '@baishou/ui'
import {
  canConfirmNotebookDataManage,
  type NotebookDataManageAction
} from './notebook-data-manage.util'
import styles from './NotebookDataManageDialog.module.css'

export type NotebookDataManageConfirm = {
  action: NotebookDataManageAction
  vector: boolean
  graph: boolean
}

export type NotebookDataManageDialogProps = {
  open: boolean
  busy?: boolean
  onClose: () => void
  onConfirm: (input: NotebookDataManageConfirm) => Promise<void> | void
}

export const NotebookDataManageDialog: React.FC<NotebookDataManageDialogProps> = ({
  open,
  busy = false,
  onClose,
  onConfirm
}) => {
  const { t } = useTranslation()
  const phrase = t('knowledge.data_manage_clear_phrase', '确认清除')
  const [action, setAction] = useState<NotebookDataManageAction>('reprocess')
  const [vector, setVector] = useState(true)
  const [graph, setGraph] = useState(true)
  const [typed, setTyped] = useState('')

  const canSubmit = canConfirmNotebookDataManage({
    action,
    vector,
    graph,
    phrase,
    typed
  })

  const resetAndClose = () => {
    if (busy) return
    setAction('reprocess')
    setVector(true)
    setGraph(true)
    setTyped('')
    onClose()
  }

  const submit = async () => {
    if (!canSubmit || busy) return
    await onConfirm({ action, vector, graph })
  }

  return (
    <Modal
      isOpen={open}
      onClose={resetAndClose}
      closeOnOverlayClick={!busy}
      animation="fade"
      zIndex={3200}
      className={styles.modal}
      title={t('knowledge.data_manage', '数据管理')}
    >
      <p className={styles.intro}>
        {action === 'clear'
          ? t(
              'knowledge.data_manage_clear_intro',
              '勾选要清除的派生数据。原文还在，清除后不能恢复。'
            )
          : t(
              'knowledge.data_manage_reprocess_intro',
              '勾选要按当前模型重新整理的数据。可能耗时较长。'
            )}
      </p>
      <div className={styles.actionRow}>
        <SegmentedControl
          value={action}
          aria-label={t('knowledge.data_manage_action', '数据操作')}
          disabled={busy}
          options={[
            { value: 'reprocess', label: t('knowledge.data_manage_reprocess', '重整理数据') },
            { value: 'clear', label: t('knowledge.data_manage_clear', '清除数据') }
          ]}
          onChange={setAction}
        />
      </div>
      <div className={styles.kinds}>
        <label className={`${styles.kind}${vector ? ` ${styles.kindChecked}` : ''}`}>
          <Checkbox
            checked={vector}
            disabled={busy}
            onChange={(event) => setVector(event.target.checked)}
          />
          <span className={styles.kindText}>
            <span className={styles.kindLabel}>
              {t('knowledge.data_manage_vector', '向量知识库')}
            </span>
            <span className={styles.kindHint}>
              {action === 'clear'
                ? t(
                    'knowledge.data_manage_vector_clear_hint',
                    '只删除检索用的向量片段，资料原文还在。'
                  )
                : t(
                    'knowledge.data_manage_vector_reprocess_hint',
                    '按当前嵌入模型重新写入本笔记本的向量索引。'
                  )}
            </span>
          </span>
        </label>
        <label className={`${styles.kind}${graph ? ` ${styles.kindChecked}` : ''}`}>
          <Checkbox
            checked={graph}
            disabled={busy}
            onChange={(event) => setGraph(event.target.checked)}
          />
          <span className={styles.kindText}>
            <span className={styles.kindLabel}>{t('knowledge.data_manage_graph', '图谱')}</span>
            <span className={styles.kindHint}>
              {action === 'clear'
                ? t(
                    'knowledge.data_manage_graph_clear_hint',
                    '删除本笔记本抽出的人物和关系，人生关系图不会被改动。'
                  )
                : t(
                    'knowledge.data_manage_graph_reprocess_hint',
                    '按当前图抽取模型重新抽取本笔记本的关系。人生关系图不会被改动。'
                  )}
            </span>
          </span>
        </label>
      </div>
      {action === 'clear' ? (
        <>
          <p className={styles.confirmHint}>
            {t('knowledge.data_manage_clear_type', '请在下方输入「{{phrase}}」以确认清除：', {
              phrase
            })}
          </p>
          <Input
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter' && canSubmit) void submit()
            }}
            className={styles.phrase}
          />
        </>
      ) : null}
      <div className={styles.actions}>
        <Button type="button" variant="outlined" disabled={busy} onClick={resetAndClose}>
          {t('common.cancel', '取消')}
        </Button>
        <Button
          type="button"
          disabled={!canSubmit}
          isLoading={busy}
          onClick={() => void submit()}
        >
          {action === 'clear'
            ? t('knowledge.data_manage_clear', '清除数据')
            : t('knowledge.data_manage_reprocess', '重整理数据')}
        </Button>
      </div>
    </Modal>
  )
}
