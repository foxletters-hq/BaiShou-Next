import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, MoreHorizontal } from 'lucide-react'
import type { NotebookCardTone } from '@baishou/shared'
import { Input } from '@baishou/ui'
import { NotebookCoverEditor } from './NotebookCoverEditor'
import { NotebookCoverIcon } from './NotebookCoverIcon'
import { TONE_CLASS } from './NotebookCoverTonePicker'
import { resolveNotebookCoverMode, type NotebookCoverMode } from './notebook-cover-mode'
import styles from './KnowledgePage.module.css'

export type SortableNotebookCardModel = {
  id: string
  name: string
  icon: string
  tone: NotebookCardTone
  imageUrl?: string | null
  meta: string
}

export const SortableNotebookCard: React.FC<{
  notebook: SortableNotebookCardModel
  menuOpen: boolean
  renameDraft: string
  labels: {
    reorder: string
    menu: string
    name: string
    namePlaceholder: string
    cover: string
    coverEmoji: string
    pickIcon: string
    uploadImage: string
    clearImage: string
  }
  onOpen: () => void
  onOpenMenu: () => void
  onRenameDraftChange: (value: string) => void
  onCommitRename: () => void
  onChangeCover: (tone: NotebookCardTone) => void
  onPickIcon: () => void
  onUploadImage: () => void
  onClearImage: () => void
}> = ({
  notebook,
  menuOpen,
  renameDraft,
  labels,
  onOpen,
  onOpenMenu,
  onRenameDraftChange,
  onCommitRename,
  onChangeCover,
  onPickIcon,
  onUploadImage,
  onClearImage
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: notebook.id
  })
  const [coverBroken, setCoverBroken] = React.useState(false)
  const [coverMode, setCoverMode] = React.useState<NotebookCoverMode>(() =>
    resolveNotebookCoverMode(Boolean(notebook.imageUrl))
  )
  React.useEffect(() => {
    setCoverBroken(false)
    setCoverMode(resolveNotebookCoverMode(Boolean(notebook.imageUrl)))
  }, [notebook.imageUrl])
  const showCover = Boolean(notebook.imageUrl) && !coverBroken

  return (
    <div
      ref={setNodeRef}
      className={`${styles.notebookCardSortable} ${isDragging ? styles.notebookCardSortableDragging : ''}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition
      }}
    >
      <div
        className={`${styles.notebookCard} ${TONE_CLASS[notebook.tone]} ${
          showCover ? styles.notebookCardHasImage : ''
        } ${isDragging ? styles.notebookCardDragging : ''}`}
        role="link"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
      >
        <div className={styles.notebookCardTop}>
          <button
            type="button"
            className={styles.notebookDragHandle}
            aria-label={labels.reorder}
            {...attributes}
            {...listeners}
            onClick={(event) => event.stopPropagation()}
          >
            <GripVertical size={16} strokeWidth={2} />
          </button>
          <div
            className={styles.notebookCardMenuWrap}
            data-notebook-card-menu={notebook.id}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className={`${styles.notebookCardMenu} ${
                menuOpen ? styles.notebookCardMenuOpen : ''
              }`}
              aria-label={labels.menu}
              aria-expanded={menuOpen}
              onClick={(event) => {
                event.stopPropagation()
                onOpenMenu()
              }}
            >
              <MoreHorizontal size={16} strokeWidth={2} />
            </button>
            {menuOpen ? (
              <div className={styles.coverMenu} role="dialog">
                <label className={styles.coverMenuField}>
                  <span className={styles.coverMenuTitle}>{labels.name}</span>
                  <Input
                    fieldSize="small"
                    value={renameDraft}
                    onChange={(event) => onRenameDraftChange(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        event.stopPropagation()
                        if (!renameDraft.trim()) return
                        onCommitRename()
                      }
                    }}
                    placeholder={labels.namePlaceholder}
                    autoFocus
                  />
                </label>
                <NotebookCoverEditor
                  className={styles.coverMenuField}
                  labelClassName={styles.coverMenuTitle}
                  mode={coverMode}
                  onModeChange={setCoverMode}
                  tone={notebook.tone}
                  onToneChange={onChangeCover}
                  icon={notebook.icon}
                  onPickIcon={onPickIcon}
                  onUploadImage={onUploadImage}
                  onClearImage={onClearImage}
                  hasImage={Boolean(notebook.imageUrl)}
                  disabled={false}
                  labels={{
                    cover: labels.cover,
                    emoji: labels.coverEmoji,
                    pickIcon: labels.pickIcon,
                    uploadImage: labels.uploadImage,
                    clearImage: labels.clearImage
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
        {showCover ? (
          <>
            <img
              className={styles.notebookCardCoverFill}
              src={notebook.imageUrl ?? ''}
              alt=""
              draggable={false}
              onError={() => setCoverBroken(true)}
            />
            <div className={styles.notebookCardCoverFade} aria-hidden />
          </>
        ) : (
          <div className={styles.notebookCardVisual}>
            <span className={styles.notebookCardEmoji}>
              <NotebookCoverIcon name={notebook.icon} />
            </span>
          </div>
        )}
        <div className={styles.notebookCardBody}>
          <h2 className={styles.notebookCardTitle}>{notebook.name}</h2>
          <p className={styles.notebookCardMeta}>{notebook.meta}</p>
        </div>
      </div>
    </div>
  )
}
