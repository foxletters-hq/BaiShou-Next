import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { formatSize, isImageFile, getFileIconName } from './attachment-management.utils'
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
        <MaterialIcons name="folder-off" size={40} color={colors.textTertiary} />
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
                  <MaterialIcons
                    name={getFileIconName(item.name)}
                    size={36}
                    color={colors.textSecondary}
                  />
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
                      <MaterialIcons name="zoom-in" size={14} color={colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                  {onOpenFileLocation && (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.bgSurface + 'dd' }]}
                      onPress={() => void onOpenFileLocation(item.path)}
                      hitSlop={8}
                    >
                      <MaterialIcons name="share" size={14} color={colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                  {onDeleteDiaryAttachment && (
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.error + 'dd' }]}
                      onPress={() => void handleDeleteDiarySingle(item.path)}
                      disabled={isDeleting}
                      hitSlop={8}
                    >
                      <MaterialIcons name="delete" size={14} color={colors.textOnPrimary} />
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

              <View style={styles.diaryCardInfo}>
                <Text
                  style={[styles.diaryCardTitle, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={[styles.diaryCardMeta, { color: colors.textSecondary }]}>
                  {item.yearMonth} • {formatSize(item.sizeMB)}
                </Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {filteredDiaryAttachments.length > 10 && (
        <AttachmentPaginationBar
          current={currentDiaryPage}
          total={totalDiaryPages}
          pageSize={diaryPageSize}
          onPageChange={setCurrentDiaryPage}
          onPageSizeChange={setDiaryPageSize}
        />
      )}
    </>
  )
}
