import React from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionManagementPageProps } from './session-management.types'
import { useSessionManagementPage } from './useSessionManagementPage'
import { ConfirmDialog } from './ConfirmDialog'
import { StatsDashboard } from './StatsDashboard'
import { SessionManagementAppBar } from './SessionManagementAppBar'
import { SessionFilterBar } from './SessionFilterBar'
import { SessionList } from './SessionList'
import styles from './SessionManagementPage.module.css'

export type { SessionInfo, SessionManagementPageProps } from './session-management.types'

export const SessionManagementPage: React.FC<SessionManagementPageProps> = ({
  sessions,
  onSessionTap,
  onDeleteSession,
  onDeleteMultiple,
  onPinToggle
}) => {
  const { t } = useTranslation()
  const page = useSessionManagementPage({ sessions, onDeleteSession, onDeleteMultiple })

  return (
    <div className={styles.page}>
      <SessionManagementAppBar
        isMultiSelect={page.isMultiSelect}
        selectedCount={page.selectedIds.size}
        onSelectAll={page.selectAll}
        onClearSelection={page.clearSelection}
        onStartMultiSelect={() => page.setIsMultiSelect(true)}
        onDeleteMultiple={() => page.setDeleteTarget({ type: 'multiple' })}
      />

      <SessionFilterBar
        searchQuery={page.searchQuery}
        filterMode={page.filterMode}
        onSearchChange={page.setSearchQuery}
        onFilterChange={page.setFilterMode}
      />

      <StatsDashboard sessions={sessions} />

      <div className={styles.sessionListContainer}>
        <SessionList
          sessions={page.filteredAndSortedSessions}
          isMultiSelect={page.isMultiSelect}
          selectedIds={page.selectedIds}
          onSessionTap={onSessionTap}
          onToggleSelect={page.toggleSelect}
          onPinToggle={onPinToggle}
          onDeleteSession={(id) => page.setDeleteTarget({ type: 'single', id })}
        />
      </div>

      <ConfirmDialog
        isOpen={page.deleteTarget !== null}
        title={
          page.deleteTarget?.type === 'multiple'
            ? t(
                'agent.chat.delete_confirm_multi',
                `确定删除 $count 个对话？此操作不可撤销。`
              ).replace('$count', page.selectedIds.size.toString())
            : t('summary.delete_confirm_title', '确认删除')
        }
        message={t(
          'settings.attachment_delete_selected_confirm',
          '确定要删除吗？此操作不可撤销。'
        ).replace(
          /\$count/g,
          (page.deleteTarget?.type === 'multiple' ? page.selectedIds.size : 1).toString()
        )}
        confirmLabel={t('common.delete', '删除')}
        isDanger
        onConfirm={page.handleConfirmDelete}
        onCancel={() => page.setDeleteTarget(null)}
      />
    </div>
  )
}
