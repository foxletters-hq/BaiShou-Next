import React, { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import type { AttachmentFilterMode } from './AttachmentFilterSheet'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { OverviewCard } from './OverviewCard'
import { DiaryAttachmentGrid } from './DiaryAttachmentGrid'
import { AttachmentFilterSheet } from './AttachmentFilterSheet'

export const DiaryAttachmentPane: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const { colors } = useNativeTheme()
  const [filterSheet, setFilterSheet] = useState<AttachmentFilterMode | null>(null)

  const {
    t,
    formatSize,
    diaryTotalSizeMB,
    diaryAttachments,
    diaryOrphanSizeMB,
    availableYears,
    diaryYear,
    setDiaryYear,
    diaryMonth,
    setDiaryMonth,
    diaryOrphanOnly,
    setDiaryOrphanOnly,
    pagedDiaryAttachments,
    selectedDiaryPaths,
    isDeleting,
    handleDeleteDiarySelected,
    toggleSelectAllDiary
  } = vm

  return (
    <View>
      <OverviewCard
        items={[
          {
            label: t('settings.diary_attachment_total_size', '日记附件空间'),
            value: formatSize(diaryTotalSizeMB),
            valueColor: colors.primary
          },
          {
            label: t('settings.diary_attachment_total_count', '日记文件总数'),
            value: String(diaryAttachments.length)
          },
          {
            label: t('settings.diary_attachment_orphans_size', '孤立残余体积'),
            value: formatSize(diaryOrphanSizeMB),
            valueColor: diaryOrphanSizeMB > 0 ? colors.error : colors.textPrimary
          }
        ]}
      />

      <View style={styles.toolbar}>
        <View style={styles.filterRow}>
          {availableYears.length > 0 && (
            <TouchableOpacity
              style={[styles.filterChip, { borderColor: colors.borderSubtle }]}
              onPress={() => setFilterSheet('year')}
            >
              <MaterialIcons name="calendar-today" size={14} color={colors.textSecondary} />
              <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
                {diaryYear === 'all'
                  ? t('gallery.filter_all_years', '全部年份')
                  : `${diaryYear}${t('common.year_suffix', '年')}`}
              </Text>
              <MaterialIcons name="expand-more" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.filterChip, { borderColor: colors.borderSubtle }]}
            onPress={() => setFilterSheet('month')}
          >
            <MaterialIcons name="folder" size={14} color={colors.textSecondary} />
            <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
              {diaryMonth === 'all'
                ? t('settings.all_months', '全部月份')
                : `${diaryMonth}${t('common.month_suffix', '月')}`}
            </Text>
            <MaterialIcons name="expand-more" size={14} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, { borderColor: colors.borderSubtle }]}
            onPress={() => setFilterSheet('orphan')}
          >
            <MaterialIcons name="label" size={14} color={colors.textSecondary} />
            <Text style={[styles.filterChipText, { color: colors.textPrimary }]}>
              {diaryOrphanOnly
                ? t('settings.tag_orphan', '孤立附件')
                : t('settings.all_filters', '全部筛选')}
            </Text>
            <MaterialIcons name="expand-more" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {pagedDiaryAttachments.length > 0 && selectedDiaryPaths.size > 0 && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.error, borderColor: colors.error }
              ]}
              onPress={() => void handleDeleteDiarySelected()}
              disabled={isDeleting}
            >
              <MaterialIcons name="delete" size={16} color={colors.textOnPrimary} />
              <Text style={[styles.actionBtnText, { color: colors.textOnPrimary }]}>
                {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                  '$count',
                  selectedDiaryPaths.size.toString()
                )}
              </Text>
            </TouchableOpacity>
          )}
          {pagedDiaryAttachments.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.borderSubtle }]}
              onPress={toggleSelectAllDiary}
            >
              <MaterialIcons name="check-box" size={16} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
                {selectedDiaryPaths.size === pagedDiaryAttachments.length
                  ? t('settings.attachment_deselect_all', '取消全选')
                  : t('settings.attachment_select_all', '全选本页')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <DiaryAttachmentGrid vm={vm} />

      <AttachmentFilterSheet
        visible={filterSheet !== null}
        mode={filterSheet ?? 'year'}
        availableYears={availableYears}
        diaryYear={diaryYear}
        diaryMonth={diaryMonth}
        diaryOrphanOnly={diaryOrphanOnly}
        onClose={() => setFilterSheet(null)}
        onSelectYear={setDiaryYear}
        onSelectMonth={setDiaryMonth}
        onSelectOrphanOnly={setDiaryOrphanOnly}
      />
    </View>
  )
}
