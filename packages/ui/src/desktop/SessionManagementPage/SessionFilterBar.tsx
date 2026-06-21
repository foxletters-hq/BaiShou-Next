import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import styles from './SessionManagementPage.module.css'

interface SessionFilterBarProps {
  searchQuery: string
  filterMode: 'all' | 'pinned'
  onSearchChange: (query: string) => void
  onFilterChange: (mode: 'all' | 'pinned') => void
}

export const SessionFilterBar: React.FC<SessionFilterBarProps> = ({
  searchQuery,
  filterMode,
  onSearchChange,
  onFilterChange
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.filterBar}>
      <div className={styles.searchBox}>
        <Search size={16} color="var(--text-secondary)" style={{ marginRight: 8 }} />
        <input
          className={styles.searchInput}
          placeholder={t('common.search_hint', '搜索记忆...')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div
        className={`${styles.filterTag} ${filterMode === 'all' ? styles.filterTagActive : ''}`}
        onClick={() => onFilterChange('all')}
      >
        {t('common.view_all', '查看全部')}
      </div>
      <div
        className={`${styles.filterTag} ${filterMode === 'pinned' ? styles.filterTagActive : ''}`}
        onClick={() => onFilterChange('pinned')}
      >
        {t('agent.sessions.pinned_only', '已置顶 📌')}
      </div>
    </div>
  )
}
