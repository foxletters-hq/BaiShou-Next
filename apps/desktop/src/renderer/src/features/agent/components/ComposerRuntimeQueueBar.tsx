import { CornerDownLeft, Pencil, Trash2 } from 'lucide-react'
import { formatPendingQueueCountLabel } from '../utils/pending-queue-messages.util'
import styles from './ComposerRuntimeQueueBar.module.css'

export type ComposerRuntimeQueueItem = {
  id: string
  text: string
  userMessageId?: string
}

export function ComposerRuntimeQueueBar(props: {
  items: ComposerRuntimeQueueItem[]
  editingInputId?: string | null
  t: (key: string, fallback: string) => string
  onSendNow: (item: ComposerRuntimeQueueItem) => void | Promise<void>
  onEdit: (item: ComposerRuntimeQueueItem) => void
  onDelete: (item: ComposerRuntimeQueueItem) => void | Promise<void>
}) {
  const { items, editingInputId, t, onSendNow, onEdit, onDelete } = props
  if (items.length === 0) return null

  return (
    <div className={styles.queueBar} role="status">
      <div className={styles.queueHeader}>
        <span className={styles.queueCount}>{formatPendingQueueCountLabel(items.length)}</span>
      </div>
      <ul className={styles.queueList}>
        {items.map((item) => {
          const editing = editingInputId === item.id
          return (
            <li
              key={item.id}
              className={`${styles.queueItem}${editing ? ` ${styles.queueItemEditing}` : ''}`}
            >
              <span className={styles.queueText}>
                {item.text.trim()
                  ? item.text
                  : t('input.upload_attachment', '上传附件')}
              </span>
              {editing ? (
                <span className={styles.editingLabel}>{t('agent.queue_editing', '编辑中')}</span>
              ) : null}
              <div className={styles.queueActions}>
                <button
                  type="button"
                  className={styles.queueAction}
                  onClick={() => void onSendNow(item)}
                  title={t('agent.queue_send_now', '立即发送')}
                >
                  <CornerDownLeft size={13} strokeWidth={1.75} aria-hidden />
                  <span>{t('agent.queue_send_now', '立即发送')}</span>
                </button>
                <button
                  type="button"
                  className={styles.queueIconBtn}
                  onClick={() => onEdit(item)}
                  aria-label={t('common.edit', '编辑')}
                >
                  <Pencil size={13} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className={styles.queueIconBtn}
                  onClick={() => void onDelete(item)}
                  aria-label={t('common.delete', '删除')}
                >
                  <Trash2 size={13} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function ComposerQueueEditTag(props: {
  visible: boolean
  t: (key: string, fallback: string) => string
  onDismiss: () => void
}) {
  if (!props.visible) return null
  return (
    <div className={styles.editTagRow}>
      <span className={styles.editTag}>
        {props.t('agent.queue_editing_tag', '编辑排队')}
        <button
          type="button"
          className={styles.editTagClose}
          onClick={props.onDismiss}
          aria-label={props.t('common.cancel', '取消')}
        >
          ×
        </button>
      </span>
    </div>
  )
}
