import React from 'react'
import { FolderMinus, Trash2, FolderSearch, Maximize2 } from 'lucide-react'
import { Checkbox } from '../Checkbox/Checkbox'
import styles from './AttachmentManagementView.module.css'
import { Pagination } from '../Pagination'
import { PageSizeSelector } from '../PageSizeSelector'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'

export const EmojiAttachmentGrid: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const {
    t,
    formatSize,
    getFileIcon,
    isImageFile,
    emojiAttachments,
    pagedEmojiAttachments,
    selectedEmojiPaths,
    emojiPageSize,
    setEmojiPageSize,
    currentEmojiPage,
    totalEmojiPages,
    setCurrentEmojiPage,
    thumbnailCache,
    toggleSelectEmoji,
    handleOpenImagePreview,
    imagePreviewLoading,
    onOpenFileLocation,
    handleDeleteEmojiSingle,
    isDeletingEmoji
  } = vm

  if (emojiAttachments.length === 0) {
    return (
      <div className={styles.diaryContentArea}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap} aria-hidden>
            <FolderMinus className={styles.emptyIcon} size={36} strokeWidth={1.5} />
          </div>
          <span className={styles.emptyText}>
            {t('settings.emoji_no_attachments', '当前还没有表情包附件')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.diaryContentArea}>
      {emojiAttachments.length > 10 && (
        <div className={styles.paginationRowTop}>
          <PageSizeSelector
            value={emojiPageSize}
            options={[10, 20, 30, 50, 80, 100]}
            onChange={setEmojiPageSize}
          />
          <Pagination
            current={currentEmojiPage}
            total={totalEmojiPages}
            onChange={setCurrentEmojiPage}
            showJumper={true}
            jumperPlaceholder={t('version_control.jump_page', '跳页')}
          />
        </div>
      )}
      <div className={styles.diaryGrid}>
        {pagedEmojiAttachments.map((item) => {
          const isChecked = selectedEmojiPaths.has(item.relativePath)
          const isImage = isImageFile(item.name) && Boolean(item.path)
          const thumbnailSrc = item.path ? thumbnailCache.get(item.path) : undefined
          const meta = item.isMissing
            ? t('settings.emoji_attachment_missing_label', '文件缺失')
            : item.groupNames.length > 0
              ? item.groupNames.join(' · ')
              : t('settings.emoji_attachment_unused_label', '未编入组')
          return (
            <div
              key={item.relativePath}
              className={`${styles.diaryCard} ${isChecked ? styles.diaryCardSelected : ''}`}
              onClick={() => toggleSelectEmoji(item.relativePath, !isChecked)}
            >
              <div className={styles.diaryCardPreview}>
                {isImage && thumbnailSrc ? (
                  <img
                    src={thumbnailSrc}
                    alt={item.name}
                    className={styles.diaryPreviewImg}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.diaryPreviewFallback}>{getFileIcon(item.name, 36)}</div>
                )}

                <div className={styles.diaryCardCheckbox} onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isChecked}
                    onChange={(e) => toggleSelectEmoji(item.relativePath, e.target.checked)}
                  />
                </div>

                {(item.isMissing || item.groupNames.length === 0) && (
                  <span className={styles.diaryBadgeOrphan}>
                    {item.isMissing
                      ? t('settings.emoji_attachment_missing_label', '文件缺失')
                      : t('settings.emoji_attachment_unused_label', '未编入组')}
                  </span>
                )}

                <div className={styles.diaryCardHoverActions} onClick={(e) => e.stopPropagation()}>
                  {isImage && item.path ? (
                    <button
                      type="button"
                      className={styles.diaryHoverActionBtn}
                      onClick={() => handleOpenImagePreview(item.path, item.name)}
                      title={t('settings.attachment_preview_image', '查看原图')}
                      disabled={imagePreviewLoading}
                    >
                      <Maximize2 size={12} />
                    </button>
                  ) : null}
                  {onOpenFileLocation && item.path ? (
                    <button
                      type="button"
                      className={styles.diaryHoverActionBtn}
                      onClick={() => onOpenFileLocation(item.path)}
                      title={t('settings.open_file_location', '在文件夹中显示')}
                    >
                      <FolderSearch size={14} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`${styles.diaryHoverActionBtn} ${styles.diaryHoverActionBtnDanger}`}
                    onClick={() => handleDeleteEmojiSingle(item.relativePath)}
                    title={t('common.delete', '删除')}
                    disabled={isDeletingEmoji}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className={styles.diaryCardInfo}>
                <span className={styles.diaryCardTitle} title={item.name}>
                  {item.name}
                </span>
                <span className={styles.diaryCardMeta}>
                  {meta} • {formatSize(item.sizeMB)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {emojiAttachments.length > 10 && (
        <div className={styles.paginationRow}>
          <PageSizeSelector
            value={emojiPageSize}
            options={[10, 20, 30, 50, 80, 100]}
            onChange={setEmojiPageSize}
          />
          <Pagination
            current={currentEmojiPage}
            total={totalEmojiPages}
            onChange={setCurrentEmojiPage}
            showJumper={true}
            jumperPlaceholder={t('version_control.jump_page', '跳页')}
          />
        </div>
      )}
    </div>
  )
}
