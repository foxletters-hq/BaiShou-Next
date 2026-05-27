import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MdCloud, MdDragIndicator } from 'react-icons/md'
import styles from './AIModelServicesView.module.css'

export const ProviderStaticItem: React.FC<{
  p: { id: string; name: string; iconUrl?: string; isSystem?: boolean }
  isActive: boolean
  isEnabled: boolean
  renderIcon: (iconUrl?: string) => React.ReactNode
  t: (key: string, fallback?: string) => string
}> = ({ p, isActive, isEnabled, renderIcon, t }) => (
  <div
    className={`${styles.listItem} ${isActive ? styles.listItemSelected : ''} ${styles.providerItemDragging}`}
  >
    <div className={styles.dragHandle}>
      <MdDragIndicator size={18} />
    </div>
    <div className={styles.listIconBox}>{renderIcon(p.iconUrl)}</div>
    <div className={styles.listNameCol}>
      <div className={styles.listNameVal}>{p.name}</div>
    </div>
    <div className={styles.tagsArea}>
      {!p.isSystem && (
        <div className={styles.customBadge}>{t('agent.provider.custom_tag', '自定义')}</div>
      )}
      <div className={`${styles.statusBadge} ${isEnabled ? styles.statusOn : styles.statusOff}`}>
        {isEnabled ? t('settings.status_on', 'ON') : t('settings.status_off', 'OFF')}
      </div>
    </div>
  </div>
)

export const ProviderSortableItem: React.FC<{
  p: { id: string; name: string; iconUrl?: string; isSystem?: boolean }
  isActive: boolean
  isEnabled: boolean
  onClick: () => void
  renderIcon: (iconUrl?: string) => React.ReactNode
  t: (key: string, fallback?: string) => string
}> = ({ p, isActive, isEnabled, onClick, renderIcon, t }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: p.id
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.listItem} ${isActive ? styles.listItemSelected : ''}`}
      onClick={onClick}
    >
      <div
        {...attributes}
        {...listeners}
        className={styles.dragHandle}
        style={{ cursor: 'grab', touchAction: 'none' }}
      >
        <MdDragIndicator size={18} />
      </div>
      <div className={styles.listIconBox}>{renderIcon(p.iconUrl)}</div>
      <div className={styles.listNameCol}>
        <div className={styles.listNameVal}>{p.name}</div>
      </div>
      <div className={styles.tagsArea}>
        {!p.isSystem && (
          <div className={styles.customBadge}>{t('agent.provider.custom_tag', '自定义')}</div>
        )}
        <div className={`${styles.statusBadge} ${isEnabled ? styles.statusOn : styles.statusOff}`}>
          {isEnabled ? t('settings.status_on', 'ON') : t('settings.status_off', 'OFF')}
        </div>
      </div>
    </div>
  )
}
