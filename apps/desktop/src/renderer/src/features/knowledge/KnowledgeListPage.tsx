import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { MoreHorizontal, Plus } from 'lucide-react'
import { KnowledgeShell } from './KnowledgeShell'
import { KnowledgeDialog } from './KnowledgeDialog'
import { getNotebookCardAppearance, type NotebookCardTone } from './notebook-card-appearance'
import styles from './KnowledgePage.module.css'

interface WorkspaceOutletContext {
  setFolderRoot: (path: string | null) => void
}

type NotebookRow = {
  id: string
  name: string
  description?: string
  updatedAt?: number
  createdAt?: number
}

type NotebookStats = {
  sources: number
  chunks: number
  pendingJobs: number
  originalBytes: number
  totalBytes: number
}

const TONE_CLASS: Record<NotebookCardTone, string> = {
  lavender: styles.toneLavender,
  cream: styles.toneCream,
  peach: styles.tonePeach,
  mint: styles.toneMint,
  sky: styles.toneSky,
  rose: styles.toneRose,
  lilac: styles.toneLilac,
  sand: styles.toneSand
}

function formatNotebookDate(ts: number | undefined, locale: string): string {
  if (!ts || !Number.isFinite(ts)) return ''
  try {
    return new Date(ts).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return new Date(ts).toLocaleDateString()
  }
}

export const KnowledgeListPage: React.FC = () => {
  const { t, i18n } = useTranslation()
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
    const sorted = [...(list || [])].sort(
      (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)
    )
    setNotebooks(sorted)
    const next: Record<string, NotebookStats> = {}
    await Promise.all(
      sorted.map(async (nb) => {
        try {
          const stats = await window.api.knowledge.getStats(nb.id)
          next[nb.id] = {
            sources: stats.sources,
            chunks: stats.chunks,
            pendingJobs: stats.pendingJobs,
            originalBytes: stats.originalBytes ?? 0,
            totalBytes: stats.totalBytes ?? 0
          }
        } catch {
          next[nb.id] = {
            sources: 0,
            chunks: 0,
            pendingJobs: 0,
            originalBytes: 0,
            totalBytes: 0
          }
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

  const locale = i18n.language || 'zh-CN'

  return (
    <KnowledgeShell setFolderRoot={setFolderRoot}>
      <motion.div
        className={`${styles.mainInner} ${styles.listMainInner}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className={styles.listSectionHead}>
          <h1 className={styles.listSectionTitle}>
            {t('knowledge.recent_notebooks', '最近打开过的笔记本')}
          </h1>
        </div>

        {error ? <p className={styles.errorLine}>{error}</p> : null}

        <div className={styles.listGrid}>
          <button
            type="button"
            className={styles.createCard}
            onClick={() => setShowCreate(true)}
            disabled={busy}
          >
            <span className={styles.createCardIcon} aria-hidden>
              <Plus size={22} strokeWidth={2.25} />
            </span>
            <span className={styles.createCardLabel}>
              {t('knowledge.new_notebook', '新建笔记本')}
            </span>
          </button>

          {notebooks.map((nb) => {
            const appearance = getNotebookCardAppearance(nb.id)
            const stats = statsById[nb.id]
            const dateLabel = formatNotebookDate(nb.updatedAt ?? nb.createdAt, locale)
            const sourcesLabel = t('knowledge.source_count', '{{count}} 个来源', {
              count: stats?.sources ?? '…'
            })
            const meta = [dateLabel, sourcesLabel].filter(Boolean).join(' · ')

            return (
              <button
                key={nb.id}
                type="button"
                className={`${styles.notebookCard} ${TONE_CLASS[appearance.tone]}`}
                onClick={() => navigate(`/agent-workspace/knowledge/${nb.id}`)}
              >
                <div className={styles.notebookCardTop}>
                  <span className={styles.notebookCardEmoji} aria-hidden>
                    {appearance.icon}
                  </span>
                  <span className={styles.notebookCardMenu} aria-hidden>
                    <MoreHorizontal size={16} strokeWidth={2} />
                  </span>
                </div>
                <div>
                  <h2 className={styles.notebookCardTitle}>{nb.name}</h2>
                  <p className={styles.notebookCardMeta}>
                    {meta}
                    {stats && stats.pendingJobs > 0
                      ? ` · ${t('knowledge.indexing', '索引中')} ${stats.pendingJobs}`
                      : ''}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>

      <KnowledgeDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        closeDisabled={busy}
        title={t('knowledge.new_notebook', '新建笔记本')}
        aria-label={t('knowledge.new_notebook', '新建笔记本')}
      >
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
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setShowCreate(false)}
            disabled={busy}
          >
            {t('common.cancel', '取消')}
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => void onCreate()}
            disabled={busy || !name.trim()}
          >
            {t('knowledge.create_action', '创建')}
          </button>
        </div>
      </KnowledgeDialog>
    </KnowledgeShell>
  )
}
