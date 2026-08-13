import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Unlink, X } from 'lucide-react'
import { Modal } from '@baishou/ui'
import styles from './WorkbenchNotebookMountDialog.module.css'

type NotebookRow = { id: string; name: string }

export interface WorkbenchNotebookMountDialogProps {
  open: boolean
  sessionId?: string
  onClose: () => void
}

export const WorkbenchNotebookMountDialog: React.FC<WorkbenchNotebookMountDialogProps> = ({
  open,
  sessionId,
  onClose
}) => {
  const { t } = useTranslation()
  const [notebookId, setNotebookId] = useState<string | undefined>()
  const [notebookName, setNotebookName] = useState('')
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!sessionId || sessionId === 'new-session') {
      setNotebookId(undefined)
      setNotebookName('')
      setNotebooks([])
      return
    }
    setError('')
    try {
      const [binding, list] = await Promise.all([
        window.api.agentWorkspace.getBinding(sessionId),
        window.api.knowledge.listNotebooks() as Promise<NotebookRow[]>
      ])
      const id = binding?.notebookId?.trim() || undefined
      setNotebookId(id)
      setNotebooks(list || [])
      if (!id) {
        setNotebookName('')
        return
      }
      const match = (list || []).find((n) => n.id === id)
      setNotebookName(match?.name || id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [sessionId])

  useEffect(() => {
    if (!open) return
    void refresh()
  }, [open, refresh])

  const attach = async (id: string | null) => {
    if (!sessionId || sessionId === 'new-session') return
    setBusy(true)
    setError('')
    try {
      await window.api.agentWorkspace.attachNotebook({ sessionId, notebookId: id })
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('workbench.notebook_mount', '知识库笔记本')}
      containToContentCard
    >
      <div className={styles.body}>
        <div className={styles.statusRow}>
          <BookOpen size={16} strokeWidth={1.75} aria-hidden className={styles.icon} />
          <div className={styles.statusText}>
            <span className={styles.statusLabel}>
              {t('workbench.mounted_notebooks', '当前挂载')}
            </span>
            {notebookId ? (
              <span className={styles.mounted} title={notebookId}>
                {notebookName || notebookId}
              </span>
            ) : (
              <span className={styles.unmounted}>
                {t('workbench.notebook_not_mounted', '未挂载')}
              </span>
            )}
          </div>
          {notebookId ? (
            <button
              type="button"
              className={styles.actionBtn}
              disabled={busy}
              title={t('workbench.detach_notebook', '取消挂载')}
              onClick={() => void attach(null)}
            >
              <Unlink size={14} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}

        <p className={styles.hint}>{t('workbench.pick_notebook', '选择要挂载的笔记本')}</p>

        {!sessionId || sessionId === 'new-session' ? (
          <p className={styles.empty}>{t('workbench.need_session_for_notebook', '请先打开一个会话')}</p>
        ) : notebooks.length === 0 ? (
          <p className={styles.empty}>
            {t('workbench.no_notebooks', '暂无笔记本，请先在知识库创建。')}
          </p>
        ) : (
          <ul className={styles.list}>
            {notebooks.map((nb) => (
              <li key={nb.id}>
                <button
                  type="button"
                  className={`${styles.notebookBtn} ${nb.id === notebookId ? styles.notebookBtnActive : ''}`}
                  disabled={busy}
                  onClick={() => void attach(nb.id)}
                >
                  {nb.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={14} strokeWidth={1.75} aria-hidden />
            {t('common.close', '关闭')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
