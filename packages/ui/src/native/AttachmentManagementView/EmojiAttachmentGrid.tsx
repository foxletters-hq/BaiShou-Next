import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { FolderMinus, Share2, Trash2, ZoomIn } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { Checkbox } from '../Checkbox'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { formatSize, getFileIcon, isImageFile } from './attachment-management.utils'
import { AttachmentPaginationBar } from './AttachmentPaginationBar'
import { AttachmentImageThumb } from './AttachmentImageThumb'

export const EmojiAttachmentGrid: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const { colors } = useNativeTheme()
  const {
    t,
    emojiAttachments,
    pagedEmojiAttachments,
    selectedEmojiPaths,
    emojiPageSize,
    setEmojiPageSize,
    currentEmojiPage,
    totalEmojiPages,
    setCurrentEmojiPage,
    toDisplayUri,
    loadImageUri,
    toggleSelectEmoji,
    handleOpenImagePreview,
    onOpenFileLocation,
    handleDeleteEmojiSingle,
    isDeletingEmoji
  } = vm

  if (emojiAttachments.length === 0) {
    return (
      <View style={styles.emptyState}>
        <FolderMinus size={40} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('settings.emoji_no_attachments', '当前还没有表情包附件')}
        </Text>
      </View>
    )
  }

  return (
    <>
      {emojiAttachments.length > 10 && (
        <AttachmentPaginationBar
          current={currentEmojiPage}
          total={totalEmojiPages}
          pageSize={emojiPageSize}
          onPageChange={setCurrentEmojiPage}
          onPageSizeChange={setEmojiPageSize}
        />
      )}

      <View style={styles.diaryGrid}>
        {pagedEmojiAttachments.map((item) => {
          const isChecked = selectedEmojiPaths.has(item.relativePath)
          const isImage = isImageFile(item.name) && Boolean(item.path)
          const meta = item.isMissing
            ? t('settings.emoji_attachment_missing_label', '文件缺失')
            : item.groupNames.length > 0
              ? item.groupNames.join(' · ')
              : t('settings.emoji_attachment_unused_label', '未编入组')
          return (
            <TouchableOpacity
              key={item.relativePath}
              activeOpacity={0.8}
              style={[
                styles.diaryCard,
                {
                  backgroundColor: isChecked ? colors.bgSurface : colors.bgSurfaceHighest,
                  borderColor: isChecked ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => toggleSelectEmoji(item.relativePath, !isChecked)}
            >
              <View style={[styles.diaryPreview, { backgroundColor: colors.bgSurface }]}>
                {isImage ? (
                  <AttachmentImageThumb
                    filePath={item.path}
                    fileName={item.name}
                    toDisplayUri={toDisplayUri}
                    loadImageUri={loadImageUri}
                    fill
                    style={styles.diaryPreviewImage}
                  />
                ) : (
                  getFileIcon(item.name, 36, colors.textSecondary)
                )}

                {(item.isMissing || item.groupNames.length === 0) && (
                  <View style={[styles.diaryOrphanBadge, { backgroundColor: colors.error + 'cc' }]}>
                    <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: '600' }}>
                      {item.isMissing
                        ? t('settings.emoji_attachment_missing_label', '文件缺失')
                        : t('settings.emoji_attachment_unused_label', '未编入组')}
                    </Text>
                  </View>
                )}

                <View style={styles.diaryCardActions}>
                  {isImage ? (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.bgSurface + 'dd' }]}
                      onPress={() => handleOpenImagePreview(item.path, item.name)}
                      hitSlop={8}
                    >
                      <ZoomIn
                        size={14}
                        color={colors.textPrimary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    </TouchableOpacity>
                  ) : null}
                  {onOpenFileLocation && item.path ? (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.bgSurface + 'dd' }]}
                      onPress={() => void onOpenFileLocation(item.path)}
                      hitSlop={8}
                    >
                      <Share2
                        size={14}
                        color={colors.textPrimary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.error + 'dd' }]}
                    onPress={() => void handleDeleteEmojiSingle(item.relativePath)}
                    disabled={isDeletingEmoji}
                    hitSlop={8}
                  >
                    <Trash2
                      size={14}
                      color={colors.textOnPrimary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.diaryCheckbox}>
                  <Checkbox selected={isChecked} />
                </View>
              </View>

              <Text
                style={[styles.diaryCardTitle, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {item.name}
              </Text>
              <Text style={[styles.diaryCardMeta, { color: colors.textSecondary }]}>
                {meta} · {formatSize(item.sizeMB)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </>
  )
}
