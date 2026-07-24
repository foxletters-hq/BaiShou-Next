import React from 'react'
import { FolderMinus, Trash2, FolderSearch, Maximize2 } from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import { Pagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'

export interface DiaryAttachmentGridProps {
  vm: AttachmentManagementViewModel
}

export const DiaryAttachmentGrid: React.FC<DiaryAttachmentGridProps> = ({ vm }) => {
  const {
    t,
    formatSize,
    getFileIcon,
    isImageFile,
    diaryAttachments,
    filteredDiaryAttachments,
    pagedDiaryAttachments,
    selectedDiaryPaths,
    diaryPageSize,
    setDiaryPageSize,
    currentDiaryPage,
    totalDiaryPages,
    setCurrentDiaryPage,
    thumbnailCache,
    toggleSelectDiary,
    handleOpenImagePreview,
    imagePreviewLoading,
    onOpenFileLocation,
    onDeleteDiaryAttachment,
    handleDeleteDiarySingle,
    isDeleting,
    hasActiveDiaryFilters,
    clearDiaryFilters
  } = vm

  if (filteredDiaryAttachments.length === 0) {
    const isFilterEmpty = diaryAttachments.length > 0 && hasActiveDiaryFilters
    return (
      <div className={styles.diaryContentArea}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap} aria-hidden>
            <FolderMinus className={styles.emptyIcon} size={36} strokeWidth={1.5} />
          </div>
          <span className={styles.emptyText}>
            {isFilterEmpty
              ? t('settings.diary_no_attachments_found', '没有匹配到符合筛选条件的日记附件')
              : t('settings.diary_no_attachments', '当前还没有日记附件')}
          </span>
          {isFilterEmpty && (
            <button type="button" className={styles.emptyActionBtn} onClick={clearDiaryFilters}>
              {t('settings.attachment_clear_filters', '清除筛选')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.diaryContentArea}>
      {filteredDiaryAttachments.length > 10 && (
        <div className={styles.paginationRowTop}>
          <PageSizeSelector
            value={diaryPageSize}
            options={[10, 20, 30, 50, 80, 100]}
            onChange={setDiaryPageSize}
          />
          <Pagination
            current={currentDiaryPage}
            total={totalDiaryPages}
            onChange={setCurrentDiaryPage}
            showJumper={true}
            jumperPlaceholder={t('version_control.jump_page', '跳页')}
          />
        </div>
      )}
      <div className={styles.diaryGrid}>
        {pagedDiaryAttachments.map((item) => {
          const isChecked = selectedDiaryPaths.has(item.path)
          const isImage = isImageFile(item.name)
          const thumbnailSrc = thumbnailCache.get(item.path)
          return (
            <div
              key={item.path}
              className={`${styles.diaryCard} ${isChecked ? styles.diaryCardSelected : ''}`}
              onClick={() => toggleSelectDiary(item.path, !isChecked)}
            >
              <div className={styles.diaryCardPreview}>
                {isImage ? (
                  thumbnailSrc ? (
                    <img
                      src={thumbnailSrc}
                      alt={item.name}
                      className={styles.diaryPreviewImg}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.diaryPreviewFallback}>
                      {getFileIcon(item.name, 36)}
                    </div>
                  )
                ) : (
                  <div className={styles.diaryPreviewFallback}>
                    {getFileIcon(item.name, 36)}
                  </div>
                )}

                <div className={styles.diaryCardCheckbox} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className={styles.customCheck}
                    checked={isChecked}
                    onChange={(e) => toggleSelectDiary(item.path, e.target.checked)}
                  />
                </div>

                {item.isOrphan && (
                  <span className={styles.diaryBadgeOrphan}>
                    {t('settings.attachment_orphan_label', '孤立')}
                  </span>
                )}

                <div
                  className={styles.diaryCardHoverActions}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isImage && (
                    <button
                      type="button"
                      className={styles.diaryHoverActionBtn}
                      onClick={() => handleOpenImagePreview(item.path, item.name)}
                      title={t('settings.attachment_preview_image', '查看原图')}
                      disabled={imagePreviewLoading}
                    >
                      <Maximize2 size={12} />
                    </button>
                  )}
                  {onOpenFileLocation && (
                    <button
                      type="button"
                      className={styles.diaryHoverActionBtn}
                      onClick={() => onOpenFileLocation(item.path)}
                      title={t('settings.open_file_location', '在文件夹中显示')}
                    >
                      <FolderSearch size={14} />
                    </button>
                  )}
                  {onDeleteDiaryAttachment && (
                    <button
                      type="button"
                      className={`${styles.diaryHoverActionBtn} ${styles.diaryHoverActionBtnDanger}`}
                      onClick={() => handleDeleteDiarySingle(item.path)}
                      title={t('common.delete', '删除')}
                      disabled={isDeleting}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.diaryCardInfo}>
                <span className={styles.diaryCardTitle} title={item.name}>
                  {item.name}
                </span>
                <span className={styles.diaryCardMeta}>
                  {item.yearMonth} • {formatSize(item.sizeMB)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {filteredDiaryAttachments.length > 10 && (
        <div className={styles.paginationRow}>
          <PageSizeSelector
            value={diaryPageSize}
            options={[10, 20, 30, 50, 80, 100]}
            onChange={setDiaryPageSize}
          />
          <Pagination
            current={currentDiaryPage}
            total={totalDiaryPages}
            onChange={setCurrentDiaryPage}
            showJumper={true}
            jumperPlaceholder={t('version_control.jump_page', '跳页')}
          />
        </div>
      )}
    </div>
  )
}
