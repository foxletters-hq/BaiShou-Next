import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAssistantKindBadgeTheme,
  getAssistantKindLabelKey,
  type AssistantKind
} from '@baishou/shared'
import styles from './AssistantKindBadge.module.css'

export interface AssistantKindBadgeProps {
  kind?: AssistantKind | string | null
  compact?: boolean
}

export const AssistantKindBadge: React.FC<AssistantKindBadgeProps> = ({ kind, compact }) => {
  const { t } = useTranslation()
  const theme = getAssistantKindBadgeTheme(kind)

  return (
    <span
      className={`${styles.badge} ${compact ? styles.compact : ''}`}
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      {t(getAssistantKindLabelKey(kind))}
    </span>
  )
}
