import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import styles from './AssistantEditPage.module.css'

interface AssistantEditAppBarProps {
  isEditing: boolean
  onBack: () => void
}

export const AssistantEditAppBar: React.FC<AssistantEditAppBarProps> = ({ isEditing, onBack }) => {
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
    </div>
  )
}
