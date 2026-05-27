import React from 'react'
import { useTranslation } from 'react-i18next'
import { ListChecks, ArrowDownToLine, Trash2 } from 'lucide-react'
import styles from './SessionManagementPage.module.css'

interface SessionManagementAppBarProps {
  isMultiSelect: boolean
  selectedCount: number
  onSelectAll: () => void
  onClearSelection: () => void
  onStartMultiSelect: () => void
  onDeleteMultiple: () => void
}

export const SessionManagementAppBar: React.FC<SessionManagementAppBarProps> = ({
  isMultiSelect,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onStartMultiSelect,
  onDeleteMultiple
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.appBar}>
      <span className={styles.appBarTitle}>
        <ListChecks size={28} color="var(--color-primary)" />
        {t('agent.sessions.management_title', '会话管理')}
      </span>
      <div className={styles.appBarActions}>
        <button
          className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
          title={t('common.export', '导出')}
        >
          <ArrowDownToLine size={16} /> {t('common.export', '导出')}
        </button>

        {isMultiSelect ? (
          <>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
              onClick={onSelectAll}
            >
              {t('agent.chat.select_all', '全选')}
            </button>
            <button
              className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
              onClick={onClearSelection}
            >
              {t('common.cancel', '取消')}
            </button>
            {selectedCount > 0 && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={onDeleteMultiple}
              >
                <Trash2 size={16} /> {t('common.delete', '删除')} ({selectedCount})
              </button>
            )}
          </>
        ) : (
          <button
            className={`${styles.actionBtn} ${styles.actionBtnOutline}`}
            onClick={onStartMultiSelect}
          >
            <ListChecks size={16} /> {t('agent.sessions.batch_manage', '批量管理')}
          </button>
        )}
      </div>
    </div>
  )
}
