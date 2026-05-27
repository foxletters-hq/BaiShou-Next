import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Trash2 } from 'lucide-react'
import styles from './AssistantEditPage.module.css'

interface AssistantEditAppBarProps {
  isEditing: boolean
  isLastAssistant: boolean
  canDelete: boolean
  onBack: () => void
  onDeleteClick: () => void
}

export const AssistantEditAppBar: React.FC<AssistantEditAppBarProps> = ({
  isEditing,
  isLastAssistant,
  canDelete,
  onBack,
  onDeleteClick
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.appBar}>
      <div className={styles.appBarLeft}>
        <button className={styles.iconBtn} onClick={onBack}>
          <ChevronLeft size={24} />
        </button>
        <span className={styles.appBarTitle}>
          {isEditing
            ? t('agent.assistant.edit_title', '编辑伙伴')
            : t('agent.assistant.create_title', '创建伙伴')}
        </span>
      </div>
      {isEditing && !isLastAssistant && canDelete && (
        <button
          className={styles.iconBtn}
          onClick={onDeleteClick}
          title={t('common.delete', '删除')}
        >
          <Trash2 size={24} />
        </button>
      )}
    </div>
  )
}
