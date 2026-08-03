import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { KnowledgeShell } from './KnowledgeShell'
import styles from './KnowledgePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

type NotebookRow = {
  id: string
  name: string
  description?: string
  updatedAt?: number
}

type NotebookStats = {
  sources: number
  chunks: number
  pendingJobs: number
}

export const KnowledgeListPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setFolderRoot } = useOutletContext<WorkspaceOutletContext>()
  const [notebooks, setNotebooks] = useState<NotebookRow[]>([])
  const [statsById, setStatsById] = useState<Record<string, NotebookStats>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    const list = (await window.api.knowledge.listNotebooks()) as NotebookRow[]
    setNotebooks(list || [])
    const next: Record<string, NotebookStats> = {}
    await Promise.all(
      (list || []).map(async (nb) => {
        try {
          const stats = await window.api.knowledge.getStats(nb.id)
          next[nb.id] = {
            sources: stats.sources,
            chunks: stats.chunks,
            pendingJobs: stats.pendingJobs
          }
        } catch {
          next[nb.id] = { sources: 0, chunks: 0, pendingJobs: 0 }
        }
      })
    )
    setStatsById(next)
  }, [])

  useEffect(() => {
    void refresh().catch((e) => setError(String(e?.message || e)))
  }, [refresh])

  const onCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    try {
      const created = await window.api.knowledge.createNotebook({
        name: trimmed,
        description: description.trim() || undefined
      })
      setShowCreate(false)
      setName('')
      setDescription('')
      await refresh()
      navigate(`/agent-workspace/knowledge/${created.id}`)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KnowledgeShell setFolderRoot={setFolderRoot}>
      <div className={styles.mainInner}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{t('knowledge.title', '知识库')}</h1>
            <p className={styles.subtitle}>
              {t('knowledge.list_subtitle', '按主题隔离的向量笔记本：导入资料，提问并获得带引用的回答。')}
            </p>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => setShowCreate(true)}
              disabled={busy}
            >
              {t('knowledge.new_notebook', '新建笔记本')}
            </button>
          </div>
        </div>

        {error ? <p className={styles.errorLine}>{error}</p> : null}

        {notebooks.length === 0 ? (
          <div className={styles.empty}>{t('knowledge.empty_notebooks', '还没有笔记本，先新建一个主题容器。')}</div>
        ) : (
          <div className={styles.grid}>
            {notebooks.map((nb) => {
              const stats = statsById[nb.id]
              return (
                <button
                  key={nb.id}
                  type="button"
                  className={styles.card}
                  onClick={() => navigate(`/agent-workspace/knowledge/${nb.id}`)}
                >
                  <h2 className={styles.cardTitle}>{nb.name}</h2>
                  <p className={styles.cardMeta}>
                    {t('knowledge.notebook_meta', '{{sources}} 份资料 · {{chunks}} 片段', {
                      sources: stats?.sources ?? '…',
                      chunks: stats?.chunks ?? '…'
                    })}
                    {stats && stats.pendingJobs > 0
                      ? ` · ${t('knowledge.indexing', '索引中')} ${stats.pendingJobs}`
                      : ''}
                  </p>
                  {nb.description ? <p className={styles.cardMeta}>{nb.description}</p> : null}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showCreate ? (
        <div className={styles.dialogBackdrop} role="presentation" onClick={() => !busy && setShowCreate(false)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.dialogTitle}>{t('knowledge.new_notebook', '新建笔记本')}</h2>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('knowledge.notebook_name', '名称')}</span>
              <input
                className={styles.fieldInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('knowledge.notebook_name_placeholder', '例如：AI 安全研究')}
                autoFocus
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t('knowledge.notebook_desc', '描述（可选）')}</span>
              <textarea
                className={styles.fieldTextarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setShowCreate(false)} disabled={busy}>
                {t('common.cancel', '取消')}
              </button>
              <button type="button" className={styles.btnPrimary} onClick={() => void onCreate()} disabled={busy || !name.trim()}>
                {t('knowledge.create_action', '创建')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </KnowledgeShell>
  )
}
