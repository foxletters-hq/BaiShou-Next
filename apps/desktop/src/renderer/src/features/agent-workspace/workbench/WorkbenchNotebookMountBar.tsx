import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, Unlink, X } from 'lucide-react'
import styles from './WorkbenchNotebookMountBar.module.css'

type NotebookRow = { id: string; name: string }

export interface WorkbenchNotebookMountBarProps {
  sessionId?: string
}

export const WorkbenchNotebookMountBar: React.FC<WorkbenchNotebookMountBarProps> = ({
  sessionId
}) => {
  const { t } = useTranslation()
  const [notebookId, setNotebookId] = useState<string | undefined>()
  const [notebookName, setNotebookName] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refreshBinding = useCallback(async () => {
    if (!sessionId || sessionId === 'new-session') {
      setNotebookId(undefined)
      setNotebookName('')
      return
    }
    const binding = await window.api.agentWorkspace.getBinding(sessionId)
    const id = binding?.notebookId?.trim() || undefined
    setNotebookId(id)
    if (!id) {
      setNotebookName('')
      return
    }
    try {
      const list = (await window.api.knowledge.listNotebooks()) as NotebookRow[]
      const match = list.find((n) => n.id === id)
      setNotebookName(match?.name || id)
    } catch {
      setNotebookName(id)
    }
  }, [sessionId])

  useEffect(() => {
    void refreshBinding().catch(() => {
      setNotebookId(undefined)
      setNotebookName('')
    })
  }, [refreshBinding])

  const openPicker = async () => {
    setError('')
    setPickerOpen(true)
    try {
      const list = (await window.api.knowledge.listNotebooks()) as NotebookRow[]
      setNotebooks(list || [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const attach = async (id: string | null) => {
    if (!sessionId || sessionId === 'new-session') return
    setBusy(true)
    setError('')
    try {
      await window.api.agentWorkspace.attachNotebook({ sessionId, notebookId: id })
      setPickerOpen(false)
      await refreshBinding()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!sessionId || sessionId === 'new-session') return null

  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <BookOpen size={14} strokeWidth={1.75} aria-hidden className={styles.icon} />
        <span className={styles.label}>{t('workbench.notebook_mount', '知识库笔记本')}</span>
        {notebookId ? (
          <span className={styles.mounted} title={notebookId}>
            {notebookName || notebookId}
          </span>
        ) : (
          <span className={styles.unmounted}>{t('workbench.notebook_not_mounted', '未挂载')}</span>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.actionBtn}
            disabled={busy}
            title={t('workbench.attach_notebook', '挂载笔记本')}
            onClick={() => void openPicker()}
          >
            {t('workbench.attach_notebook_short', '挂载')}
          </button>
          {notebookId ? (
            <button
              type="button"
              className={styles.actionBtn}
              disabled={busy}
              title={t('workbench.detach_notebook', '取消挂载')}
              onClick={() => void attach(null)}
            >
              <Unlink size={13} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {pickerOpen ? (
        <div
          className={styles.picker}
          role="dialog"
          aria-label={t('workbench.attach_notebook', '挂载笔记本')}
        >
          <div className={styles.pickerHeader}>
            <span>{t('workbench.pick_notebook', '选择要挂载的笔记本')}</span>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => setPickerOpen(false)}
              title={t('common.close', '关闭')}
            >
              <X size={14} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          {notebooks.length === 0 ? (
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
        </div>
      ) : null}
    </div>
  )
}
