import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import type { NotebookCardTone } from '@baishou/shared'
import { Input } from '@baishou/ui'
import { KnowledgeShell } from './KnowledgeShell'
import { KnowledgeDialog } from './KnowledgeDialog'
import { NotebookCoverEmojiPicker } from './NotebookCoverEmojiPicker'
import { NotebookCoverTonePicker } from './NotebookCoverTonePicker'
import { SortableNotebookCard } from './SortableNotebookCard'
import { getNotebookCardAppearance } from './notebook-card-appearance'
import {
  applyNotebookDragReorder,
  resolveNotebookCoverPreviewUrl,
  resolveNotebookRename,
  sortNotebooksForList
} from './notebook-list.util'
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
  sortOrder?: number
  coverTone?: string
  coverIcon?: string
  coverImage?: string
  coverImageUrl?: string | null
}

type NotebookStats = {
  sources: number
  chunks: number
  pendingJobs: number
  originalBytes: number
  totalBytes: number
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

function asNotebookRows(list: unknown): NotebookRow[] {
  if (!Array.isArray(list)) return []
  return list.filter((row): row is NotebookRow => {
    return Boolean(row && typeof row === 'object' && typeof (row as NotebookRow).id === 'string')
  })
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
  const [createTone, setCreateTone] = useState<NotebookCardTone | ''>('')
  const [createIcon, setCreateIcon] = useState('')
  const [iconPickerTarget, setIconPickerTarget] = useState<'create' | string | null>(null)
  const [createCoverPath, setCreateCoverPath] = useState('')
  const [createCoverName, setCreateCoverName] = useState('')
  const [cardMenuId, setCardMenuId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const skipCardClickRef = useRef(false)
  const renameDraftRef = useRef('')
  const notebooksRef = useRef<NotebookRow[]>([])
  const commitRenameRef = useRef<(notebookId: string, draft: string) => Promise<boolean>>(
    async () => false
  )
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )
  const notebookIds = useMemo(() => notebooks.map((row) => row.id), [notebooks])

  const refresh = useCallback(async () => {
    setError('')
    const list = asNotebookRows(await window.api.knowledge.listNotebooks())
    setNotebooks(sortNotebooksForList(list))
    const next: Record<string, NotebookStats> = {}
    try {
      const statsList = await window.api.knowledge.listNotebookStats()
      for (const row of statsList || []) {
        next[row.notebookId] = {
          sources: row.sources,
          chunks: row.chunks,
          pendingJobs: row.pendingJobs,
          originalBytes: row.originalBytes ?? 0,
          totalBytes: row.totalBytes ?? 0
        }
      }
    } catch {
      /* 聚合失败时卡片显示 0，不回退 N+1 getStats */
    }
    setStatsById(next)
  }, [])

  useEffect(() => {
    notebooksRef.current = notebooks
  }, [notebooks])

  useEffect(() => {
    renameDraftRef.current = renameDraft
  }, [renameDraft])

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
        description: description.trim() || undefined,
        coverTone: createTone || undefined,
        coverIcon: createIcon || undefined
      })
      if (createCoverPath) {
        await window.api.knowledge.setCoverImage({
          notebookId: created.id,
          absolutePath: createCoverPath
        })
      }
      setShowCreate(false)
      setName('')
      setDescription('')
      setCreateTone('')
      setCreateIcon('')
      setCreateCoverPath('')
      setCreateCoverName('')
      await refresh()
      navigate(`/agent-workspace/knowledge/${created.id}`)
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const onDragEnd = async (event: DragEndEvent) => {
    skipCardClickRef.current = true
    queueMicrotask(() => {
      skipCardClickRef.current = false
    })
    const overId = event.over?.id
    if (overId == null) return
    const previous = notebooks
    const next = applyNotebookDragReorder(notebooks, String(event.active.id), String(overId))
    if (!next) return
    setNotebooks(next)
    try {
      const saved = asNotebookRows(
        await window.api.knowledge.reorderNotebooks(next.map((row) => row.id))
      )
      setNotebooks(sortNotebooksForList(saved.length ? saved : next))
    } catch (e: unknown) {
      setNotebooks(previous)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const openNotebook = (id: string) => {
    if (skipCardClickRef.current) return
    navigate(`/agent-workspace/knowledge/${id}`)
  }

  const commitRename = useCallback(async (notebookId: string, draft: string) => {
    const current = notebooksRef.current.find((row) => row.id === notebookId)
    const nextName = resolveNotebookRename(current?.name ?? '', draft)
    if (!current || !nextName) return false
    const previous = notebooksRef.current
    setNotebooks((rows) =>
      rows.map((row) => (row.id === notebookId ? { ...row, name: nextName } : row))
    )
    try {
      await window.api.knowledge.updateNotebook({ notebookId, name: nextName })
      return true
    } catch (e: unknown) {
      setNotebooks(previous)
      setError(e instanceof Error ? e.message : String(e))
      return false
    }
  }, [])

  useEffect(() => {
    commitRenameRef.current = commitRename
  }, [commitRename])

  const closeCardMenu = useCallback((commitName = true) => {
    const id = cardMenuId
    if (id && commitName) {
      void commitRenameRef.current(id, renameDraftRef.current)
    }
    setCardMenuId(null)
  }, [cardMenuId])

  useEffect(() => {
    if (!cardMenuId) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest(`[data-notebook-card-menu="${cardMenuId}"]`)) return
      closeCardMenu(true)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCardMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [cardMenuId, closeCardMenu])

  const changeCoverTone = async (notebookId: string, coverTone: NotebookCardTone) => {
    const previous = notebooks
    setNotebooks((rows) =>
      rows.map((row) => (row.id === notebookId ? { ...row, coverTone } : row))
    )
    try {
      await window.api.knowledge.updateNotebook({ notebookId, coverTone })
    } catch (e: unknown) {
      setNotebooks(previous)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const changeCoverIcon = async (notebookId: string, coverIcon: string) => {
    const previous = notebooks
    setNotebooks((rows) =>
      rows.map((row) => (row.id === notebookId ? { ...row, coverIcon } : row))
    )
    try {
      await window.api.knowledge.updateNotebook({ notebookId, coverIcon })
    } catch (e: unknown) {
      setNotebooks(previous)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const pickCoverImage = async (): Promise<PickedFile | null> => {
    const files = await window.api.pickFiles({
      properties: ['openFile'],
      filters: [
        {
          name: t('knowledge.cover_image_filters', '图片'),
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
        }
      ]
    })
    return files?.[0] ?? null
  }

  const uploadCoverImage = async (notebookId: string) => {
    const file = await pickCoverImage()
    if (!file?.filePath) return
    try {
      const saved = await window.api.knowledge.setCoverImage({
        notebookId,
        absolutePath: file.filePath
      })
      setNotebooks((rows) =>
        rows.map((row) =>
          row.id === notebookId
            ? {
                ...row,
                coverImage: saved.coverImage,
                coverImageUrl: saved.coverImageUrl ?? null,
                updatedAt: Date.now()
              }
            : row
        )
      )
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const clearCoverImage = async (notebookId: string) => {
    const previous = notebooks
    setNotebooks((rows) =>
      rows.map((row) =>
        row.id === notebookId ? { ...row, coverImage: '', coverImageUrl: null } : row
      )
    )
    try {
      await window.api.knowledge.updateNotebook({ notebookId, coverImage: '' })
    } catch (e: unknown) {
      setNotebooks(previous)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const pickCreateCoverImage = async () => {
    const file = await pickCoverImage()
    if (!file?.filePath) return
    setCreateCoverPath(file.filePath)
    setCreateCoverName(file.fileName || file.filePath)
  }

  const openCardMenu = (nb: NotebookRow) => {
    setCardMenuId((current) => {
      if (current === nb.id) {
        void commitRenameRef.current(nb.id, renameDraftRef.current)
        return null
      }
      if (current) {
        void commitRenameRef.current(current, renameDraftRef.current)
      }
      setRenameDraft(nb.name)
      return nb.id
    })
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
          <h1 className={styles.listSectionTitle}>{t('knowledge.notebooks', '笔记本')}</h1>
        </div>

        {error ? <p className={styles.errorLine}>{error}</p> : null}

        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(event) => void onDragEnd(event)}>
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

            <SortableContext items={notebookIds} strategy={rectSortingStrategy}>
              {notebooks.map((nb) => {
                const appearance = getNotebookCardAppearance(nb.id, {
                  coverTone: nb.coverTone,
                  coverIcon: nb.coverIcon
                })
                const stats = statsById[nb.id]
                const dateLabel = formatNotebookDate(nb.updatedAt ?? nb.createdAt, locale)
                const sourcesLabel =
                  stats?.sources == null
                    ? t('knowledge.source_count_pending', '… 个来源')
                    : t('knowledge.source_count', '{{count}} 个来源', { count: stats.sources })
                const meta = [dateLabel, sourcesLabel].filter(Boolean).join(' · ')
                const pending =
                  stats && stats.pendingJobs > 0
                    ? ` · ${t('knowledge.indexing', '索引中')} ${stats.pendingJobs}`
                    : ''

                return (
                  <SortableNotebookCard
                    key={nb.id}
                    notebook={{
                      id: nb.id,
                      name: nb.name,
                      icon: appearance.icon,
                      tone: appearance.tone,
                      imageUrl: resolveNotebookCoverPreviewUrl(nb.coverImageUrl, nb.updatedAt),
                      meta: `${meta}${pending}`
                    }}
                    menuOpen={cardMenuId === nb.id}
                    renameDraft={renameDraft}
                    labels={{
                      reorder: t('knowledge.reorder_notebook', '拖动排序'),
                      menu: t('knowledge.notebook_card_menu', '笔记本选项'),
                      name: t('knowledge.notebook_name', '名称'),
                      namePlaceholder: t(
                        'knowledge.notebook_name_placeholder',
                        '笔记本名称'
                      ),
                      coverTone: t('knowledge.cover_tone', '封面颜色'),
                      coverIcon: t('knowledge.cover_icon', '封面图标'),
                      pickIcon: t('knowledge.pick_cover_icon', '选择图标'),
                      coverImage: t('knowledge.cover_image', '封面图片'),
                      uploadImage: t('knowledge.upload_cover_image', '上传图片'),
                      clearImage: t('knowledge.clear_cover_image', '清除图片')
                    }}
                    onOpen={() => openNotebook(nb.id)}
                    onOpenMenu={() => openCardMenu(nb)}
                    onRenameDraftChange={setRenameDraft}
                    onCommitRename={() => {
                      void commitRename(nb.id, renameDraft).then(() => {
                        setCardMenuId(null)
                      })
                    }}
                    onChangeCover={(tone) => void changeCoverTone(nb.id, tone)}
                    onPickIcon={() => {
                      void commitRenameRef.current(nb.id, renameDraftRef.current)
                      setCardMenuId(null)
                      setIconPickerTarget(nb.id)
                    }}
                    onUploadImage={() => void uploadCoverImage(nb.id)}
                    onClearImage={() => void clearCoverImage(nb.id)}
                  />
                )
              })}
            </SortableContext>
          </div>
        </DndContext>
      </motion.div>

      <KnowledgeDialog
        open={showCreate}
        onClose={() => {
          if (busy) return
          setShowCreate(false)
          setCreateCoverPath('')
          setCreateCoverName('')
        }}
        closeDisabled={busy}
        title={t('knowledge.new_notebook', '新建笔记本')}
        aria-label={t('knowledge.new_notebook', '新建笔记本')}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.notebook_name', '名称')}</span>
          <Input
            fieldSize="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('knowledge.notebook_name_placeholder', '笔记本名称')}
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
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.cover_tone', '封面颜色')}</span>
          <NotebookCoverTonePicker value={createTone} onChange={setCreateTone} disabled={busy} />
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.cover_icon', '封面图标')}</span>
          <button
            type="button"
            className={styles.coverIconTrigger}
            onClick={() => setIconPickerTarget('create')}
            disabled={busy}
          >
            {createIcon ? (
              <span className={styles.coverIconPreview} aria-hidden>
                {createIcon}
              </span>
            ) : null}
            {t('knowledge.pick_cover_icon', '选择图标')}
          </button>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('knowledge.cover_image', '封面图片')}</span>
          <div className={styles.coverImageActions}>
            <button
              type="button"
              className={styles.coverImageBtn}
              onClick={() => void pickCreateCoverImage()}
              disabled={busy}
            >
              {t('knowledge.upload_cover_image', '上传图片')}
            </button>
            {createCoverPath ? (
              <button
                type="button"
                className={styles.coverImageBtn}
                onClick={() => {
                  setCreateCoverPath('')
                  setCreateCoverName('')
                }}
                disabled={busy}
              >
                {t('knowledge.clear_cover_image', '清除图片')}
              </button>
            ) : null}
          </div>
          {createCoverName ? <p className={styles.coverImageName}>{createCoverName}</p> : null}
        </div>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              if (busy) return
              setShowCreate(false)
              setCreateCoverPath('')
              setCreateCoverName('')
            }}
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
      <NotebookCoverEmojiPicker
        open={iconPickerTarget != null}
        onClose={() => setIconPickerTarget(null)}
        onSelect={(emoji) => {
          const target = iconPickerTarget
          setIconPickerTarget(null)
          if (!target) return
          if (target === 'create') {
            setCreateIcon(emoji)
            return
          }
          void changeCoverIcon(target, emoji)
        }}
      />
    </KnowledgeShell>
  )
}
