import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import type { AttachmentManagementViewModel } from './useAttachmentManagementView'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { formatSize, getFileIconName, isImageFile } from './attachment-management.utils'
import { AttachmentImageThumb } from './AttachmentImageThumb'

type Vm = Pick<
  AttachmentManagementViewModel,
  | 't'
  | 'activeTab'
  | 'displayList'
  | 'pagedSessionList'
  | 'selectedIds'
  | 'expandedIds'
  | 'isDeleting'
  | 'toggleSelect'
  | 'toggleExpand'
  | 'handleDeleteSingleGroup'
  | 'onOpenFileLocation'
  | 'handleDeleteSingleFile'
  | 'toDisplayUri'
  | 'loadImageUri'
  | 'handleOpenImagePreview'
>

export const SessionAttachmentGroupList: React.FC<{ vm: Vm }> = ({ vm }) => {
  const { colors } = useNativeTheme()
  const {
    t,
    activeTab,
    displayList,
    pagedSessionList,
    selectedIds,
    expandedIds,
    isDeleting,
    toggleSelect,
    toggleExpand,
    handleDeleteSingleGroup,
    onOpenFileLocation,
    handleDeleteSingleFile,
    toDisplayUri,
    loadImageUri,
    handleOpenImagePreview
  } = vm

  if (displayList.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialIcons
          name={activeTab === 'orphans' ? 'check-circle' : 'folder-off'}
          size={40}
          color={colors.textTertiary}
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {activeTab === 'orphans'
            ? t('settings.attachment_no_orphans', '没有发现已删除会话的残留附件')
            : t('settings.attachment_no_attachments', '当前没有任何会话关联的附件')}
        </Text>
      </View>
    )
  }

  return (
    <>
      {pagedSessionList.map((group) => {
        const isChecked = selectedIds.has(group.sessionId)
        const isExpanded = expandedIds.has(group.sessionId)
        return (
          <View key={group.sessionId}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.folderItem,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: isChecked ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => toggleExpand(group.sessionId)}
            >
              <TouchableOpacity
                onPress={() => toggleSelect(group.sessionId, !isChecked)}
                hitSlop={8}
              >
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.borderSubtle },
                    isChecked && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                >
                  {isChecked && (
                    <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>

              <View
                style={[
                  styles.folderIconBox,
                  {
                    backgroundColor: group.isOrphan ? colors.error + '18' : colors.primary + '18'
                  }
                ]}
              >
                <MaterialIcons
                  name={group.isOrphan ? 'folder-off' : 'folder'}
                  size={20}
                  color={group.isOrphan ? colors.error : colors.primary}
                />
              </View>

              <View style={styles.folderInfo}>
                <View style={styles.folderTitleRow}>
                  <Text
                    style={[styles.folderTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {group.sessionTitle ||
                      t('settings.attachment_orphan_session', '已删除的会话残留')}
                  </Text>
                  {group.isOrphan && (
                    <View style={[styles.orphanBadge, { backgroundColor: colors.error + '22' }]}>
                      <Text style={[styles.orphanBadgeText, { color: colors.error }]}>
                        {t('settings.attachment_orphan_label', '孤立')}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.folderSubtitle, { color: colors.textSecondary }]}>
                  {group.fileCount} {t('settings.files_count', '个文件')} •{' '}
                  {group.isOrphan
                    ? `UUID: ${group.sessionId.slice(0, 8)}…`
                    : t('settings.active_session', '活动对话')}
                </Text>
              </View>

              <Text style={[styles.folderSize, { color: colors.textSecondary }]}>
                {formatSize(group.totalSizeMB)}
              </Text>

              <View style={styles.folderActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => void handleDeleteSingleGroup(group.sessionId)}
                  disabled={isDeleting}
                  hitSlop={8}
                >
                  <MaterialIcons name="delete" size={18} color={colors.error} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
                  <MaterialIcons
                    name={isExpanded ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View
                style={[
                  styles.sessionFileListCard,
                  {
                    backgroundColor: colors.bgSurface,
                    borderColor: colors.borderSubtle
                  }
                ]}
              >
                {group.files.map((file) => {
                  const isImage = isImageFile(file.name)
                  return (
                    <View key={file.path} style={styles.fileItem}>
                      {isImage ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => handleOpenImagePreview(file.path, file.name)}
                          hitSlop={4}
                        >
                          <AttachmentImageThumb
                            filePath={file.path}
                            fileName={file.name}
                            toDisplayUri={toDisplayUri}
                            loadImageUri={loadImageUri}
                          />
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={[
                            styles.sessionFileThumb,
                            { borderColor: colors.borderSubtle, backgroundColor: colors.bgApp }
                          ]}
                        >
                          <MaterialIcons
                            name={getFileIconName(file.name)}
                            size={24}
                            color={colors.textSecondary}
                          />
                        </View>
                      )}

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.fileName, { color: colors.textPrimary }]}
                          numberOfLines={2}
                        >
                          {file.name}
                        </Text>
                        <Text
                          style={[styles.fileSize, { color: colors.textSecondary, marginTop: 2 }]}
                        >
                          {formatSize(file.sizeMB)}
                        </Text>
                      </View>

                      <View style={styles.fileActions}>
                        {isImage && (
                          <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => handleOpenImagePreview(file.path, file.name)}
                            hitSlop={8}
                          >
                            <MaterialIcons name="zoom-in" size={18} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                        {onOpenFileLocation && (
                          <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => void onOpenFileLocation(file.path)}
                            hitSlop={8}
                          >
                            <MaterialIcons name="share" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => void handleDeleteSingleFile(group.sessionId, file.name)}
                          disabled={isDeleting}
                          hitSlop={8}
                        >
                          <MaterialIcons name="delete-outline" size={16} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )
      })}
    </>
  )
}
