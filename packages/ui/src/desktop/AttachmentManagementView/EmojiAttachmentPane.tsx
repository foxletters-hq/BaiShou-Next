import React from 'react'
import { motion } from 'framer-motion'
import styles from './AttachmentManagementView.module.css'
import { Button } from '../Button/Button'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { EmojiAttachmentGrid } from './EmojiAttachmentGrid'

export const EmojiAttachmentPane: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const {
    t,
    formatSize,
    emojiTotalSizeMB,
    emojiAttachments,
    emojiUnusedCount,
    pagedEmojiAttachments,
    selectedEmojiPaths,
    isDeletingEmoji,
    handleDeleteEmojiSelected,
    toggleSelectAllEmoji
  } = vm

  return (
    <motion.div
      key="emoji"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className={styles.paneContent}
    >
      <div className={styles.overviewCardWrapper}>
        <div className={styles.overviewCard}>
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.emoji_attachment_total_size', '表情包空间')}
            </span>
            <span className={`${styles.statValue} ${styles.colorPrimary}`}>
              {formatSize(emojiTotalSizeMB)}
            </span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.emoji_attachment_total_count', '表情包文件')}
            </span>
            <span className={`${styles.statValue} ${styles.colorOnSurface}`}>
              {emojiAttachments.length}
            </span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statColumn}>
            <span className={styles.statLabel}>
              {t('settings.emoji_attachment_unused_count', '未编入组 / 缺失')}
            </span>
            <span
              className={`${styles.statValue} ${emojiUnusedCount > 0 ? styles.colorError : styles.colorOnSurface}`}
            >
              {emojiUnusedCount}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.toolbarWrapper}>
        <div className={styles.tabsRow}>
          {pagedEmojiAttachments.length > 0 && selectedEmojiPaths.size > 0 && (
            <Button
              type="button"
              variant="outlined"
              size="small"
              onClick={handleDeleteEmojiSelected}
              disabled={isDeletingEmoji}
            >
              {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                '$count',
                selectedEmojiPaths.size.toString()
              )}
            </Button>
          )}
          {pagedEmojiAttachments.length > 0 && (
            <Button type="button" variant="outlined" size="small" onClick={toggleSelectAllEmoji}>
              {selectedEmojiPaths.size === pagedEmojiAttachments.length
                ? t('settings.attachment_deselect_all', '取消全选')
                : t('settings.attachment_select_all_page', '全选本页')}
            </Button>
          )}
        </div>
      </div>

      <EmojiAttachmentGrid vm={vm} />
    </motion.div>
  )
}
