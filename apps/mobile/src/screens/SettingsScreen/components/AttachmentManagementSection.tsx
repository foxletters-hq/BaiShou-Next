import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

export const AttachmentManagementSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()

  const [attachments, setAttachments] = useState<any[]>([])
  const [storageStats, setStorageStats] = useState<any>({})
  const [selectedAttachments, setSelectedAttachments] = useState<Set<string>>(new Set())
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false)

  const loadAttachments = useCallback(async () => {
    if (!services || !dbReady) return
    try {
      setIsLoadingAttachments(true)
      const sessions = await services.sessionManager.findAllSessions(500, 0)
      const activeIds = new Set<string>(sessions.map((s: { id: string }) => s.id))
      const groups = await services.attachmentManager.listSessionGroups(activeIds)
      const attachmentList = groups.map((g) => ({
        id: g.sessionId,
        name: g.sessionTitle || g.sessionId,
        sizeMB: g.totalSizeMB,
        fileCount: g.fileCount,
        isOrphan: g.isOrphan
      }))
      const totalMB = attachmentList.reduce((sum, a) => sum + (a.sizeMB || 0), 0)
      setAttachments(attachmentList)
      setStorageStats({
        attachmentCount: attachmentList.length,
        attachmentSize: `${totalMB.toFixed(2)} MB`
      })
    } catch (e) {
      console.warn('Load attachments failed', e)
    } finally {
      setIsLoadingAttachments(false)
    }
  }, [services, dbReady])

  useEffect(() => {
    loadAttachments()
  }, [loadAttachments])

  const handleToggleAttachmentSelection = (id: string) => {
    setSelectedAttachments((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAllAttachments = () => {
    if (selectedAttachments.size === attachments.length) {
      setSelectedAttachments(new Set())
    } else {
      setSelectedAttachments(new Set(attachments.map((a) => a.id)))
    }
  }

  const handleDeleteSelectedAttachments = async () => {
    if (selectedAttachments.size === 0) return
    const confirmed = await dialog.confirm(
      t('settings.attachment_delete_selected_confirm', { count: selectedAttachments.size }),
      {
        title: t('settings.attachment_clear_confirm_title'),
        confirmText: t('common.delete'),
        destructive: true
      }
    )
    if (!confirmed) return
    try {
      for (const id of selectedAttachments) {
        await services?.attachmentManager.deleteBatch([id])
      }
      setSelectedAttachments(new Set())
      await loadAttachments()
      toast.showSuccess(t('common.confirm_success'))
    } catch (e) {
      toast.showError(t('common.errors.save_failed'))
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.attachment_management')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.attachment_management_desc')}
      </Text>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.attachment_total_count')}
        </Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {attachments.length || storageStats.attachmentCount || 0}
        </Text>
      </View>

      <View style={[styles.settingItem, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>
          {t('settings.attachment_total_size')}
        </Text>
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
          {storageStats.attachmentSize || '0 MB'}
        </Text>
      </View>

      <View style={styles.attachmentActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleSelectAllAttachments}
          disabled={attachments.length === 0}
        >
          <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
            {selectedAttachments.size === attachments.length
              ? t('settings.attachment_deselect_all')
              : t('settings.attachment_select_all')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionButton,
            {
              backgroundColor: selectedAttachments.size > 0 ? colors.error : colors.bgSurfaceHighest
            }
          ]}
          onPress={handleDeleteSelectedAttachments}
          disabled={selectedAttachments.size === 0}
        >
          <Text
            style={[
              styles.actionButtonText,
              {
                color: selectedAttachments.size > 0 ? colors.textOnPrimary : colors.textSecondary
              }
            ]}
          >
            {t('settings.attachment_delete_selected', { count: selectedAttachments.size })}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoadingAttachments ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common.loading')}
          </Text>
        </View>
      ) : attachments.length > 0 ? (
        <View style={[styles.attachmentList, { backgroundColor: colors.bgSurfaceHighest }]}>
          {attachments.map((attachment) => (
            <TouchableOpacity
              key={attachment.id}
              style={[
                styles.attachmentItem,
                {
                  backgroundColor: selectedAttachments.has(attachment.id)
                    ? colors.bgSurface
                    : 'transparent',
                  borderBottomColor: colors.borderSubtle
                }
              ]}
              onPress={() => handleToggleAttachmentSelection(attachment.id)}
            >
              <View style={styles.attachmentCheckbox}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.borderSubtle },
                    selectedAttachments.has(attachment.id) && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary
                    }
                  ]}
                >
                  {selectedAttachments.has(attachment.id) && (
                    <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>✓</Text>
                  )}
                </View>
              </View>
              <View style={styles.attachmentInfo}>
                <Text
                  style={[styles.attachmentName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {attachment.name || attachment.id}
                </Text>
                <Text style={[styles.attachmentMeta, { color: colors.textSecondary }]}>
                  {attachment.fileCount || 0} • {attachment.sizeMB?.toFixed(2) || '0'} MB
                  {attachment.isOrphan && ` • ${t('settings.attachment_orphan_label')}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyContainer, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('settings.attachment_no_attachments')}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.bgSurface }]}
        onPress={loadAttachments}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
          {t('common.refresh')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16
  },
  settingItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  settingValue: {
    fontSize: 14
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  loadingText: {
    fontSize: 14,
    marginTop: 12
  },
  attachmentList: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1
  },
  attachmentCheckbox: {
    marginRight: 12
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700'
  },
  attachmentInfo: {
    flex: 1
  },
  attachmentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  attachmentMeta: {
    fontSize: 12
  },
  emptyContainer: {
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    marginBottom: 16
  },
  emptyText: {
    fontSize: 14
  }
})
