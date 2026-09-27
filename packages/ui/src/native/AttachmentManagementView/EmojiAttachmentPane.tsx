import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { CheckSquare, Trash2 } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { OverviewCard } from './OverviewCard'
import { EmojiAttachmentGrid } from './EmojiAttachmentGrid'

export const EmojiAttachmentPane: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const { colors } = useNativeTheme()
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
    <View>
      <OverviewCard
        items={[
          {
            label: t('settings.emoji_attachment_total_size', '表情包空间'),
            value: formatSize(emojiTotalSizeMB),
            valueColor: colors.primary
          },
          {
            label: t('settings.emoji_attachment_total_count', '表情包文件'),
            value: String(emojiAttachments.length)
          },
          {
            label: t('settings.emoji_attachment_unused_count', '未编入组 / 缺失'),
            value: String(emojiUnusedCount),
            valueColor: emojiUnusedCount > 0 ? colors.error : colors.textPrimary
          }
        ]}
      />

      <View style={styles.toolbar}>
        <View style={styles.tabRow}>
          {pagedEmojiAttachments.length > 0 && selectedEmojiPaths.size > 0 && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.error, borderColor: colors.error }
              ]}
              onPress={() => void handleDeleteEmojiSelected()}
              disabled={isDeletingEmoji}
            >
              <Trash2 size={16} color={colors.textOnPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
              <Text style={[styles.actionBtnText, { color: colors.textOnPrimary }]}>
                {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                  '$count',
                  selectedEmojiPaths.size.toString()
                )}
              </Text>
            </TouchableOpacity>
          )}
          {pagedEmojiAttachments.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.borderControl }]}
              onPress={toggleSelectAllEmoji}
            >
              <CheckSquare
                size={16}
                color={colors.textSecondary}
                strokeWidth={DEFAULT_STROKE_WIDTH}
              />
              <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
                {selectedEmojiPaths.size === pagedEmojiAttachments.length
                  ? t('settings.attachment_deselect_all', '取消全选')
                  : t('settings.attachment_select_all', '全选本页')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <EmojiAttachmentGrid vm={vm} />
    </View>
  )
}
