import React from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Briefcase } from 'lucide-react'
import { getAssistantKindHintKey, type AssistantKind } from '@baishou/shared'
import styles from './AssistantKindTabBar.module.css'

export interface AssistantKindTabBarProps {
  activeKind: AssistantKind
  onKindChange: (kind: AssistantKind) => void
}

export const AssistantKindTabBar: React.FC<AssistantKindTabBarProps> = ({
  activeKind,
  onKindChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.section}>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeKind === 'companion' ? styles.active : ''}`}
          onClick={() => onKindChange('companion')}
        >
          <Heart size={18} />
          {t('agent.assistant.kind_companion')}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeKind === 'work' ? styles.active : ''}`}
          onClick={() => onKindChange('work')}
        >
          <Briefcase size={18} />
          {t('agent.assistant.kind_work')}
        </button>
      </div>
      <p className={styles.hint}>{t(getAssistantKindHintKey(activeKind))}</p>
    </div>
  )
}
