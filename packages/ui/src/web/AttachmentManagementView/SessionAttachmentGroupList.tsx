import React from 'react'
import {
  CheckCircle,
  FolderMinus,
  Folder,
  Trash2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FolderSearch
} from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'

type Vm = Pick<
  AttachmentManagementViewModel,
  | 't'
  | 'formatSize'
  | 'getFileIcon'
  | 'activeTab'
  | 'displayList'
  | 'pagedSessionList'
  | 'selectedIds'
  | 'expandedIds'
  | 'isDeleting'
  | 'toggleSelect'
  | 'toggleExpand'
  | 'handleDeleteSingleGroup'
  | 'onOpenFileLocation'
  | 'handleDeleteSingleFile'
>

export const SessionAttachmentGroupList: React.FC<{ vm: Vm }> = ({ vm }) => {
  const {
    t,
    formatSize,
    getFileIcon,
    activeTab,
    displayList,
    pagedSessionList,
    selectedIds,
    expandedIds,
    isDeleting,
    toggleSelect,
    toggleExpand,
    handleDeleteSingleGroup,
    onOpenFileLocation,
    handleDeleteSingleFile
  } = vm

  if (displayList.length === 0) {
    return (
      <div className={styles.emptyState}>
        {activeTab === 'orphans' ? (
          <CheckCircle className={styles.emptyIcon} />
        ) : (
          <FolderMinus className={styles.emptyIcon} />
        )}
        <span className={styles.emptyText}>
          {activeTab === 'orphans'
            ? t('settings.attachment_no_orphans', '没有发现已删除会话的残留附件')
            : t('settings.attachment_no_attachments', '当前没有任何会话关联的附件')}
        </span>
      </div>
    )
  }

  return (
    <>
      {pagedSessionList.map((group) => {
        const isChecked = selectedIds.has(group.sessionId)
        const isExpanded = expandedIds.has(group.sessionId)
        return (
          <div key={group.sessionId}>
            <div
              className={`${styles.folderItem} ${isChecked ? styles.itemSelected : ''}`}
              onClick={() => toggleExpand(group.sessionId)}
            >
              <div className={styles.checkboxWrapper} onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className={styles.customCheck}
                  checked={isChecked}
                  onChange={(e) => toggleSelect(group.sessionId, e.target.checked)}
                />
              </div>
              <div
                className={`${styles.folderIconBox} ${group.isOrphan ? styles.folderIconBoxOrphan : ''}`}
              >
                {group.isOrphan ? <FolderMinus size={20} /> : <Folder size={20} />}
              </div>
              <div className={styles.folderInfo}>
                <div className={styles.folderTitleRow}>
                  <span
                    className={styles.folderTitle}
                    title={group.sessionTitle || group.sessionId}
                  >
                    {group.sessionTitle ||
                      t('settings.attachment_orphan_session', '已删除的会话残留')}
                  </span>
                  {group.isOrphan && (
                    <span className={styles.orphanLabel}>
                      {t('settings.attachment_orphan_label', '孤立')}
                    </span>
                  )}
                </div>
                <span className={styles.folderFilesSubtitle}>
                  {group.fileCount} {t('settings.files_count', '个文件')} •{' '}
                  {group.isOrphan
                    ? `UUID: ${group.sessionId}`
                    : t('settings.active_session', '活动对话')}
                </span>
              </div>
              <div className={styles.folderSizeWrapper}>
                <span className={styles.folderSizeValue}>
                  {formatSize(group.totalSizeMB ?? (group as { sizeMB?: number }).sizeMB ?? 0)}
                </span>
              </div>
              <div className={styles.cardHeaderActions} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`${styles.cardHeaderActionBtn} ${styles.cardHeaderActionBtnDanger}`}
                  onClick={() => handleDeleteSingleGroup(group.sessionId)}
                  title={t('settings.delete_all_files', '清理该会话所有附件')}
                  disabled={isDeleting}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  type="button"
                  className={styles.cardHeaderActionBtn}
                  onClick={() => toggleExpand(group.sessionId)}
                >
                  {isExpanded ? (
                    <ChevronUp size={18} className={styles.expandIcon} />
                  ) : (
                    <ChevronDown size={18} className={styles.expandIcon} />
                  )}
                </button>
              </div>
            </div>
            <div className={`${styles.fileListContainer} ${isExpanded ? styles.expanded : ''}`}>
              <div className={styles.fileListContent}>
                {Array.isArray(group.files) &&
                  group.files.map((file) => (
                    <div key={file.path} className={styles.fileItem}>
                      <div className={styles.fileIcon}>{getFileIcon(file.name)}</div>
                      <span className={styles.fileName} title={file.path}>
                        {file.name}
                      </span>
                      <div className={styles.fileMeta}>
                        <span className={styles.fileSize}>{formatSize(file.sizeMB)}</span>
                        <div className={styles.fileActions}>
                          {onOpenFileLocation && (
                            <button
                              type="button"
                              className={styles.fileActionBtn}
                              onClick={() => onOpenFileLocation(file.path)}
                              title={t('settings.open_file_location', '在文件夹中显示')}
                            >
                              <FolderSearch size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.fileActionBtn} ${styles.fileActionBtnDanger}`}
                            onClick={() => handleDeleteSingleFile(group.sessionId, file.name)}
                            title={t('common.delete', '删除')}
                            disabled={isDeleting}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
