import React, { useState } from 'react'
import styles from './AttachmentManagementView.module.css'
import { useTranslation } from 'react-i18next'
import { useDialog } from '../Dialog'
import { useToast } from '../Toast/useToast'
import {
  CheckCircle,
  FolderMinus,
  Folder,
  Trash2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  File,
  FileImage,
  FileVideo,
  FolderSearch
} from 'lucide-react'

export interface AttachmentFileItem {
  name: string
  path: string
  sizeMB: number
  birthtime: string
}

export interface SessionAttachmentGroup {
  sessionId: string
  sessionTitle?: string
  isOrphan: boolean
  totalSizeMB: number
  fileCount: number
  files: AttachmentFileItem[]
}

export interface AttachmentManagementViewProps {
  attachments: SessionAttachmentGroup[]
  onDeleteSelected: (ids: string[]) => Promise<void>
  onDeleteFile?: (sessionId: string, fileName: string) => Promise<void>
  onOpenFileLocation?: (path: string) => Promise<void>
}

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = ({
  attachments,
  onDeleteSelected,
  onDeleteFile,
  onOpenFileLocation
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'all' | 'orphans'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)

  const orphans = attachments.filter((a) => a.isOrphan)

  const totalSizeMB = attachments.reduce(
    (sum, item) => sum + (item.totalSizeMB ?? (item as any).sizeMB ?? 0),
    0
  )
  const totalFiles = attachments.reduce((sum, item) => sum + (item.fileCount ?? 0), 0)
  const orphanSizeMB = orphans.reduce(
    (sum, item) => sum + (item.totalSizeMB ?? (item as any).sizeMB ?? 0),
    0
  )

  const displayList = activeTab === 'all' ? attachments : orphans

  const handleSelectAll = () => {
    if (selectedIds.size === displayList.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayList.map((a) => a.sessionId)))
    }
  }

  const toggleSelect = (id: string, isChecked: boolean) => {
    const clone = new Set(selectedIds)
    if (isChecked) clone.add(id)
    else clone.delete(id)
    setSelectedIds(clone)
  }

  const toggleExpand = (id: string) => {
    const clone = new Set(expandedIds)
    if (clone.has(id)) clone.delete(id)
    else clone.add(id)
    setExpandedIds(clone)
  }

  const formatSize = (mb: number | undefined | null) => {
    if (mb === undefined || mb === null || isNaN(mb)) return '0 B'
    if (mb <= 0) return '0 B'
    if (mb < 1) return (mb * 1024).toFixed(2) + ' KB'
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB'
    return mb.toFixed(2) + ' MB'
  }

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase()
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'heic'].includes(ext || '')) {
      return <FileImage size={16} className={styles.fileIcon} />
    }
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')) {
      return <FileVideo size={16} className={styles.fileIcon} />
    }
    return <File size={16} className={styles.fileIcon} />
  }

  const handleDeleteGroups = async () => {
    if (selectedIds.size === 0) return

    let confirmMsg = t(
      'settings.attachment_delete_selected_confirm',
      '确定要删除选中的 $count 个会话的附件文件夹吗？此操作不可撤销。'
    )
    if (confirmMsg.includes('$count')) {
      confirmMsg = confirmMsg.replace('$count', selectedIds.size.toString())
    }

    const confirmed = await dialog.confirm(confirmMsg)
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteSelected(Array.from(selectedIds))
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      setSelectedIds(new Set())
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingleGroup = async (sessionId: string) => {
    const confirmed = await dialog.confirm(
      t(
        'settings.attachment_delete_group_confirm',
        '确定要删除该会话的所有附件吗？此操作不可撤销。'
      )
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteSelected([sessionId])
      toast.showSuccess(t('settings.attachment_clear_completed', '清理完成'))
      const clone = new Set(selectedIds)
      clone.delete(sessionId)
      setSelectedIds(clone)
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteSingleFile = async (sessionId: string, name: string) => {
    if (!onDeleteFile) return
    const confirmed = await dialog.confirm(
      t('settings.attachment_delete_file_confirm', '确定要删除该文件吗？此操作不可撤销。')
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await onDeleteFile(sessionId, name)
      toast.showSuccess(t('settings.attachment_file_deleted', '文件已成功删除'))
    } catch (e: any) {
      toast.showError(`${t('common.error', '错误')}: ${e.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  const deleteBtnLabel = (() => {
    let raw = t('settings.attachment_delete_selected', '删除已选 ($count)')
    if (raw.includes('$count')) raw = raw.replace('$count', selectedIds.size.toString())
    return raw
  })()

  return (
    <div className={styles.container}>
      <div className={styles.overviewCardWrapper}>
        <div className={styles.overviewCard}>
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.attachment_total_size', '总占用空间')}
            </span>
            <span className={`${styles.statValue} ${styles.colorPrimary}`}>
              {formatSize(totalSizeMB)}
            </span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.attachment_total_count', '附件总数')}
            </span>
            <span className={`${styles.statValue} ${styles.colorOnSurface}`}>{totalFiles}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.attachment_orphans_size', '孤立附件体积')}
            </span>
            <span
              className={`${styles.statValue} ${orphanSizeMB > 0 ? styles.colorError : styles.colorOnSurface}`}
            >
              {formatSize(orphanSizeMB)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.toolbarWrapper}>
        <div className={styles.tabsRow}>
          <button
            className={`${styles.actionBtn} ${activeTab === 'all' ? styles.btnFilled : styles.btnOutlined}`}
            onClick={() => {
              setActiveTab('all')
              setSelectedIds(new Set())
            }}
          >
            {t('settings.attachment_tab_all', '会话附件')} {attachments.length}
          </button>
          <button
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
              className={`${styles.actionBtn} ${styles.btnDangerFilled}`}
              onClick={handleDeleteGroups}
              disabled={isDeleting}
            >
              <Trash2 size={16} />
              {deleteBtnLabel}
            </button>
          )}

          {displayList.length > 0 && (
            <button
              className={`${styles.actionBtn} ${styles.btnOutlined}`}
              onClick={handleSelectAll}
            >
              <CheckSquare size={16} />
              {selectedIds.size === displayList.length
                ? t('settings.attachment_deselect_all', '取消全选')
                : t('settings.attachment_select_all', '全选')}
            </button>
          )}
        </div>
      </div>

      <div className={styles.listArea}>
        {displayList.length === 0 ? (
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
        ) : (
          displayList.map((group) => {
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
                      {formatSize(group.totalSizeMB ?? (group as any).sizeMB ?? 0)}
                    </span>
                  </div>

                  <div className={styles.cardHeaderActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`${styles.cardHeaderActionBtn} ${styles.cardHeaderActionBtnDanger}`}
                      onClick={() => handleDeleteSingleGroup(group.sessionId)}
                      title={t('settings.delete_all_files', '清理该会话所有附件')}
                      disabled={isDeleting}
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
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

                {isExpanded && Array.isArray(group.files) && (
                  <div className={styles.fileListContainer}>
                    {group.files.map((file) => (
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
                                className={styles.fileActionBtn}
                                onClick={() => onOpenFileLocation(file.path)}
                                title={t('settings.open_file_location', '在文件夹中显示')}
                              >
                                <FolderSearch size={14} />
                              </button>
                            )}
                            {onDeleteFile && (
                              <button
                                className={`${styles.fileActionBtn} ${styles.fileActionBtnDanger}`}
                                onClick={() => handleDeleteSingleFile(group.sessionId, file.name)}
                                title={t('common.delete', '删除')}
                                disabled={isDeleting}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
