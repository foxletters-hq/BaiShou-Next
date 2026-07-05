import React from 'react'
import { useTranslation } from 'react-i18next'
import styles from './RagMemoryView.module.css'
import { TriangleAlert } from 'lucide-react'

interface RagMemoryDisabledAlertProps {
  ragEnabled: boolean
}

export const RagMemoryDisabledAlert: React.FC<RagMemoryDisabledAlertProps> = ({ ragEnabled }) => {
  const { t } = useTranslation()

  if (ragEnabled) return null

  return (
    <div className={styles.disabledAlert}>
      <TriangleAlert size={16} style={{ marginRight: 8 }} />
      {t('settings.rag_disabled_alert', 'RAG记忆功能已经关闭了喵~')}
    </div>
  )
}
