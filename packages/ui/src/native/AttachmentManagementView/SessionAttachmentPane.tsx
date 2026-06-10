import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { OverviewCard } from './OverviewCard'
import { AttachmentPaginationBar } from './AttachmentPaginationBar'
import { SessionAttachmentGroupList } from './SessionAttachmentGroupList'

export const SessionAttachmentPane: React.FC<{ vm: AttachmentManagementViewModel }> = ({ vm }) => {
  const { colors } = useNativeTheme()
  const {
    t,
    formatSize,
    totalSizeMB,
    totalFiles,
    orphanSizeMB,
    activeTab,
    setActiveTab,
    attachments,
    orphans,
    displayList,
    selectedIds,
    setSelectedIds,
    isDeleting,
    handleDeleteGroups,
    handleSelectAll,
    pagedSessionList,
    currentSessionPage,
    setCurrentSessionPage,
    sessionPageSize,
    setSessionPageSize,
    totalSessionPages
  } = vm

  return (
    <View>
      <OverviewCard
        items={[
          {
            label: t('settings.attachment_total_size', '总占用空间'),
            value: formatSize(totalSizeMB),
            valueColor: colors.primary
          },
          {
            label: t('settings.attachment_total_count', '附件总数'),
            value: String(totalFiles)
          },
          {
            label: t('settings.attachment_orphans_size', '孤立附件体积'),
            value: formatSize(orphanSizeMB),
            valueColor: orphanSizeMB > 0 ? colors.error : colors.textPrimary
          }
        ]}
      />

      <View style={styles.toolbar}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: activeTab === 'all' ? colors.primary : 'transparent',
                borderColor: activeTab === 'all' ? colors.primary : colors.borderSubtle
              }
            ]}
            onPress={() => {
              setActiveTab('all')
              setSelectedIds(new Set())
            }}
          >
            <Text
              style={[
                styles.actionBtnText,
                { color: activeTab === 'all' ? colors.textOnPrimary : colors.textPrimary }
              ]}
            >
              {t('settings.attachment_tab_all', '会话附件')} {attachments.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: activeTab === 'orphans' ? colors.primary : 'transparent',
                borderColor: activeTab === 'orphans' ? colors.primary : colors.borderSubtle
              }
            ]}
            onPress={() => {
              setActiveTab('orphans')
              setSelectedIds(new Set())
            }}
          >
            <Text
              style={[
                styles.actionBtnText,
                {
                  color: activeTab === 'orphans' ? colors.textOnPrimary : colors.textPrimary
                }
              ]}
            >
              {t('settings.attachment_tab_orphans', '孤立残留')} {orphans.length}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {displayList.length > 0 && selectedIds.size > 0 && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.error, borderColor: colors.error }
              ]}
              onPress={() => void handleDeleteGroups()}
              disabled={isDeleting}
            >
              <MaterialIcons name="delete" size={16} color={colors.textOnPrimary} />
              <Text style={[styles.actionBtnText, { color: colors.textOnPrimary }]}>
                {t('settings.attachment_delete_selected', '删除已选 ($count)').replace(
                  '$count',
                  selectedIds.size.toString()
                )}
              </Text>
            </TouchableOpacity>
          )}
          {displayList.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.borderSubtle }]}
              onPress={handleSelectAll}
            >
              <MaterialIcons name="check-box" size={16} color={colors.textSecondary} />
              <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>
                {selectedIds.size === pagedSessionList.length
                  ? t('settings.attachment_deselect_all', '取消全选')
                  : t('settings.attachment_select_all', '全选本页')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {displayList.length > 10 && (
        <AttachmentPaginationBar
          current={currentSessionPage}
          total={totalSessionPages}
          pageSize={sessionPageSize}
          onPageChange={setCurrentSessionPage}
          onPageSizeChange={setSessionPageSize}
        />
      )}

      <SessionAttachmentGroupList vm={vm} />

      {displayList.length > 10 && (
        <AttachmentPaginationBar
          current={currentSessionPage}
          total={totalSessionPages}
          pageSize={sessionPageSize}
          onPageChange={setCurrentSessionPage}
          onPageSizeChange={setSessionPageSize}
        />
      )}
    </View>
  )
}
