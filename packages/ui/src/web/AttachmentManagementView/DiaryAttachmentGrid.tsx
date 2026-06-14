import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Folder,
  Tag,
  ChevronDown,
  FolderMinus,
  Trash2,
  CheckSquare,
  FolderSearch,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import styles from './AttachmentManagementView.module.css'
import { Pagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import { ImagePreview } from '../DiaryEditor/ImagePreview'
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
    isDeleting
  } = vm

  return (
    <div className={styles.diaryContentArea}>
      {filteredDiaryAttachments.length === 0 ? (
        <div className={styles.emptyState}>
          <FolderMinus className={styles.emptyIcon} />
          <span className={styles.emptyText}>
            {t('settings.diary_no_attachments_found', '没有匹配到符合筛选条件的日记附件')}
          </span>
        </div>
      ) : (
        <>
          {filteredDiaryAttachments.length > 10 && (
            <div className={styles.paginationRow} style={{ marginBottom: '16px' }}>
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
                  {/* 图像或格式大预览区 */}
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

                    {/* 多选复选框 */}
                    <div className={styles.diaryCardCheckbox} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={styles.customCheck}
                        checked={isChecked}
                        onChange={(e) => toggleSelectDiary(item.path, e.target.checked)}
                      />
                    </div>

                    {/* 孤立附件标签 */}
                    {item.isOrphan && (
                      <span className={styles.diaryBadgeOrphan}>
                        {t('settings.attachment_orphan_label', '孤立')}
                      </span>
                    )}

                    {/* 悬浮覆盖动作按钮 */}
                    <div
                      className={styles.diaryCardHoverActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isImage && (
                        <button
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
                          className={styles.diaryHoverActionBtn}
                          onClick={() => onOpenFileLocation(item.path)}
                          title={t('settings.open_file_location', '在文件夹中显示')}
                        >
                          <FolderSearch size={14} />
                        </button>
                      )}
                      {onDeleteDiaryAttachment && (
                        <button
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

                  {/* 下层文字信息 */}
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

          {/* 分页控制栏 */}
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
        </>
      )}
    </div>
  )
}
