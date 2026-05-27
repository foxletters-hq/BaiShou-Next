import React from 'react'
import { motion } from 'framer-motion'
import { Trash2, CheckSquare } from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import { Pagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { SessionAttachmentOverview } from './SessionAttachmentOverview'
import { SessionAttachmentGroupList } from './SessionAttachmentGroupList'

export interface SessionAttachmentPaneProps {
  vm: AttachmentManagementViewModel
}

const SessionPagination: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => (
  <div className={styles.paginationRow} style={{ marginBottom: '16px' }}>
    <PageSizeSelector
      value={vm.sessionPageSize}
      options={[10, 20, 30, 50, 80, 100]}
      onChange={vm.setSessionPageSize}
    />
    <Pagination
      current={vm.currentSessionPage}
      total={vm.totalSessionPages}
      onChange={vm.setCurrentSessionPage}
      showFirstLast
      showJumper
      jumperPlaceholder={vm.t('version_control.jump_page', '跳页')}
    />
  </div>
)

export const SessionAttachmentPane: React.FC<SessionAttachmentPaneProps> = ({ vm }) => {
  const {
    t,
    activeTab,
    setActiveTab,
    attachments,
    orphans,
    displayList,
    selectedIds,
    setSelectedIds,
    isDeleting,
    handleDeleteGroups,
    handleSelectAll,
    pagedSessionList
  } = vm

  return (
    <motion.div
      key="session"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={styles.paneContent}
    >
      <SessionAttachmentOverview vm={vm} />

      <div className={styles.toolbarWrapper}>
        <div className={styles.tabsRow}>
          <button
            type="button"
            className={`${styles.actionBtn} ${activeTab === 'all' ? styles.btnFilled : styles.btnOutlined}`}
            onClick={() => {
              setActiveTab('all')
              setSelectedIds(new Set())
            }}
          >
            {t('settings.attachment_tab_all', '会话附件')} {attachments.length}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${activeTab === 'orphans' ? styles.btnFilled : styles.btnOutlined}`}
            onClick={() => {
              setActiveTab('orphans')
              setSelectedIds(new Set())
            }}
          >
            {t('settings.attachment_tab_orphans', '孤立残留')} {orphans.length}
          </button>
        </div>
        <div className={styles.tabsRow}>
          {displayList.length > 0 && selectedIds.size > 0 && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
              onClick={handleDeleteGroups}
              disabled={isDeleting}
            >
              <Trash2 size={16} />
              {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                '$count',
                selectedIds.size.toString()
              )}
            </button>
          )}
          {displayList.length > 0 && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.btnOutlined}`}
              onClick={handleSelectAll}
            >
              <CheckSquare size={16} />
              {selectedIds.size === pagedSessionList.length
                ? t('settings.attachment_deselect_all', '取消全选')
                : t('settings.attachment_select_all', '全选本页')}
            </button>
          )}
        </div>
      </div>

      {displayList.length > 10 && <SessionPagination vm={vm} />}

      <div className={styles.listArea}>
        <SessionAttachmentGroupList vm={vm} />
      </div>

      {displayList.length > 10 && (
        <div className={styles.paginationRow}>
          <PageSizeSelector
            value={vm.sessionPageSize}
            options={[10, 20, 30, 50, 80, 100]}
            onChange={vm.setSessionPageSize}
          />
          <Pagination
            current={vm.currentSessionPage}
            total={vm.totalSessionPages}
            onChange={vm.setCurrentSessionPage}
            showFirstLast
            showJumper
            jumperPlaceholder={t('version_control.jump_page', '跳页')}
          />
        </div>
      )}
    </motion.div>
  )
}
