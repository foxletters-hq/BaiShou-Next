import React from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Briefcase } from 'lucide-react'
import {
  getAssistantKindHintKey,
  normalizeAssistantKind,
  type AssistantKind
} from '@baishou/shared'
import styles from './AssistantKindTabBar.module.css'

export interface AssistantKindTabBarProps {
  activeKind: AssistantKind
  onKindChange: (kind: AssistantKind) => void
  showHint?: boolean
  variant?: 'tabs' | 'cards'
  className?: string
}

export const AssistantKindTabBar: React.FC<AssistantKindTabBarProps> = ({
  activeKind,
  onKindChange,
  showHint = true,
  variant = 'tabs',
  className
}) => {
  const { t } = useTranslation()
  const kind = normalizeAssistantKind(activeKind)

  if (variant === 'cards') {
    return (
      <div className={`${styles.section} ${className ?? ''}`}>
        <div className={styles.cards}>
          <button
            type="button"
            className={`${styles.kindCard} ${kind === 'companion' ? styles.kindCardActive : ''}`}
            onClick={() => onKindChange('companion')}
          >
            <span className={styles.kindCardTitle}>
              <Heart size={16} />
              {t('agent.assistant.kind_companion')}
            </span>
            {showHint ? (
              <span className={styles.kindCardHint}>{t(getAssistantKindHintKey('companion'))}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`${styles.kindCard} ${kind === 'work' ? styles.kindCardActive : ''}`}
            onClick={() => onKindChange('work')}
          >
            <span className={styles.kindCardTitle}>
              <Briefcase size={16} />
              {t('agent.assistant.kind_work')}
            </span>
            {showHint ? (
              <span className={styles.kindCardHint}>{t(getAssistantKindHintKey('work'))}</span>
            ) : null}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.section} ${className ?? ''}`}>
      <div className={styles.tabs} data-active={kind}>
        <div className={styles.indicator} aria-hidden />
        <button
          type="button"
          className={`${styles.tab} ${kind === 'companion' ? styles.active : ''}`}
          onClick={() => onKindChange('companion')}
        >
          <Heart size={18} />
          {t('agent.assistant.kind_companion')}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${kind === 'work' ? styles.active : ''}`}
          onClick={() => onKindChange('work')}
        >
          <Briefcase size={18} />
          {t('agent.assistant.kind_work')}
        </button>
      </div>
      {showHint ? <p className={styles.hint}>{t(getAssistantKindHintKey(kind))}</p> : null}
    </div>
  )
}
