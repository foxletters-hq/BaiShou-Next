import React from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionInfo } from './session-management.types'
import styles from './SessionManagementPage.module.css'

interface StatsDashboardProps {
  sessions: SessionInfo[]
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ sessions }) => {
  const { t } = useTranslation()
  const totalMessages = sessions.reduce((acc, curr) => acc + (curr.messageCount || 0), 0)
  const activeAssistants = new Set(sessions.map((s) => s.assistantName)).size

  return (
    <div className={styles.statsPanel}>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>{t('agent.sessions.total_count', '会话总数')}</div>
        <div className={styles.statValue}>{sessions.length}</div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>{t('agent.sessions.total_messages', '总消息数')}</div>
        <div className={styles.statValue}>{totalMessages}</div>
      </div>
      <div className={styles.statCard}>
        <div className={styles.statLabel}>{t('agent.sessions.active_agents', '活跃伙伴数')}</div>
        <div className={styles.statValue}>{activeAssistants}</div>
      </div>
    </div>
  )
}
