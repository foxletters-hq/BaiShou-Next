import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { FolderMinus, Share2, Trash2, ZoomIn } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { formatSize, getFileIcon, isImageFile } from './attachment-management.utils'
import { AttachmentPaginationBar } from './AttachmentPaginationBar'
import { AttachmentImageThumb } from './AttachmentImageThumb'

export const DiaryAttachmentGrid: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const { colors } = useNativeTheme()
  const {
    t,
    filteredDiaryAttachments,
    pagedDiaryAttachments,
    selectedDiaryPaths,
    diaryPageSize,
    setDiaryPageSize,
    currentDiaryPage,
    totalDiaryPages,
    setCurrentDiaryPage,
    toDisplayUri,
    loadImageUri,
    toggleSelectDiary,
    handleOpenImagePreview,
    onOpenFileLocation,
    onDeleteDiaryAttachment,
    handleDeleteDiarySingle,
    isDeleting
  } = vm

  if (filteredDiaryAttachments.length === 0) {
    return (
      <View style={styles.emptyState}>
        <FolderMinus size={40} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {t('settings.diary_no_attachments_found', '没有匹配到符合筛选条件的日记附件')}
        </Text>
      </View>
    )
  }

  return (
    <>
      {filteredDiaryAttachments.length > 10 && (
        <AttachmentPaginationBar
          current={currentDiaryPage}
          total={totalDiaryPages}
          pageSize={diaryPageSize}
          onPageChange={setCurrentDiaryPage}
          onPageSizeChange={setDiaryPageSize}
        />
      )}

      <View style={styles.diaryGrid}>
        {pagedDiaryAttachments.map((item) => {
          const isChecked = selectedDiaryPaths.has(item.path)
          const isImage = isImageFile(item.name)
          return (
            <TouchableOpacity
              key={item.path}
              activeOpacity={0.8}
              style={[
                styles.diaryCard,
                {
                  backgroundColor: isChecked ? colors.bgSurface : colors.bgSurfaceHighest,
                  borderColor: isChecked ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => toggleSelectDiary(item.path, !isChecked)}
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

                {item.isOrphan && (
                  <View style={[styles.diaryOrphanBadge, { backgroundColor: colors.error + 'cc' }]}>
                    <Text style={{ color: colors.textOnPrimary, fontSize: 10, fontWeight: '700' }}>
                      {t('settings.attachment_orphan_label', '孤立')}
                    </Text>
                  </View>
                )}

                <View style={styles.diaryCardActions}>
                  {isImage && (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.bgSurface + 'dd' }]}
                      onPress={() => handleOpenImagePreview(item.path, item.name)}
                      hitSlop={8}
                    >
                      <ZoomIn size={14} color={colors.textPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                    </TouchableOpacity>
                  )}
                  {onOpenFileLocation && (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.bgSurface + 'dd' }]}
                      onPress={() => void onOpenFileLocation(item.path)}
                      hitSlop={8}
                    >
                      <Share2 size={14} color={colors.textPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                    </TouchableOpacity>
                  )}
                  {onDeleteDiaryAttachment && (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.error + 'dd' }]}
                      onPress={() => void handleDeleteDiarySingle(item.path)}
                      disabled={isDeleting}
                      hitSlop={8}
                    >
                      <Trash2 size={14} color={colors.textOnPrimary} strokeWidth={DEFAULT_STROKE_WIDTH} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.diaryCheckbox}>
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: colors.borderSubtle, marginRight: 0 },
                      isChecked && {
                        backgroundColor: colors.primary,
                        borderColor: colors.primary
                      }
                    ]}
                  >
                    {isChecked && (
                      <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>✓</Text>
                    )}
                  </View>
                </View>
              </View>

              <Text
                style={[styles.diaryCardTitle, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {item.name}
              </Text>
              <Text style={[styles.diaryCardMeta, { color: colors.textSecondary }]}>
                {formatSize(item.sizeMB)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </>
  )
}
