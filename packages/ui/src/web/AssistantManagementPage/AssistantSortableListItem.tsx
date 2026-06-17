import React, { forwardRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Pin, Trash2 } from 'lucide-react'
import { MdDragIndicator } from 'react-icons/md'
import { resolveWebAssistantAvatarSrc } from '../assistant-avatar.util'
import { AssistantKindBadge } from '../AssistantKindBadge'
import styles from './AssistantManagementPage.module.css'
import type { AssistantInfo } from './index'

type AssistantListRowProps = {
  assistant: AssistantInfo
  isPinned: boolean
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  onDelete?: (assistantId: string) => void
  dragHandleProps?: React.ButtonHTMLAttributes<HTMLButtonElement>
}

export const AssistantListRow = forwardRef<HTMLDivElement, AssistantListRowProps>(
  function AssistantListRow(
    { assistant, isPinned, className, style, onClick, onDelete, dragHandleProps },
    ref
  ) {
    return (
      <div ref={ref} style={style} className={className} onClick={onClick}>
        <button
          type="button"
          className={styles.dragHandle}
          aria-label="Reorder"
          onClick={(e) => e.stopPropagation()}
          {...dragHandleProps}
        >
          <MdDragIndicator size={20} />
        </button>

        <div className={styles.cardAvatar}>
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundImage: `url("${resolveWebAssistantAvatarSrc(assistant.avatarPath)}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
        </div>

        <div className={styles.sortableContent}>
          <div className={styles.cardNameRow}>
            <span className={styles.cardName} title={assistant.name}>
              {assistant.name}
            </span>
            <AssistantKindBadge kind={assistant.assistantKind} compact />
            {isPinned ? (
              <Pin
                size={14}
                color="var(--color-primary, #5BA8F5)"
                style={{ marginLeft: 6, opacity: 0.8 }}
              />
            ) : null}
          </div>
          <div className={styles.cardDesc}>{assistant.description || assistant.systemPrompt}</div>
        </div>

        {onDelete ? (
          <div className={styles.sortableActions} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={`${styles.cardActionBtn} ${styles.cardActionBtnDanger}`}
              title="Delete"
              onClick={() => onDelete(assistant.id)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null}
      </div>
    )
  }
)

export function AssistantSortableListItem({
  assistant,
  isPinned,
  onEdit,
  onDelete
}: {
  assistant: AssistantInfo
  isPinned: boolean
  onEdit: (assistant: AssistantInfo) => void
  onDelete: (assistantId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: assistant.id
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1
  }

  return (
    <AssistantListRow
      ref={setNodeRef}
      style={style}
      className={`${styles.sortableRow} ${isPinned ? styles.cardPinned : ''}`}
      assistant={assistant}
      isPinned={isPinned}
      onClick={() => onEdit(assistant)}
      onDelete={onDelete}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  )
}
