import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, ImagePlus, MoreHorizontal, Trash2 } from 'lucide-react'
import type { NotebookCardTone } from '@baishou/shared'
import { Input } from '@baishou/ui'
import { NotebookCoverIcon } from './NotebookCoverIcon'
import { NotebookCoverTonePicker, TONE_CLASS } from './NotebookCoverTonePicker'
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
    coverTone: string
    coverIcon: string
    pickIcon: string
    coverImage: string
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
  React.useEffect(() => {
    setCoverBroken(false)
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
                <p className={styles.coverMenuTitle}>{labels.coverTone}</p>
                <NotebookCoverTonePicker value={notebook.tone} onChange={onChangeCover} />
                <p className={styles.coverMenuTitle}>{labels.coverIcon}</p>
                <button type="button" className={styles.coverIconTrigger} onClick={onPickIcon}>
                  <span className={styles.coverIconPreview} aria-hidden>
                    {notebook.icon}
                  </span>
                  {labels.pickIcon}
                </button>
                <p className={styles.coverMenuTitle}>{labels.coverImage}</p>
                <div className={styles.coverImageActions}>
                  <button type="button" className={styles.coverImageBtn} onClick={onUploadImage}>
                    <ImagePlus size={14} />
                    {labels.uploadImage}
                  </button>
                  {notebook.imageUrl ? (
                    <button type="button" className={styles.coverImageBtn} onClick={onClearImage}>
                      <Trash2 size={14} />
                      {labels.clearImage}
                    </button>
                  ) : null}
                </div>
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
