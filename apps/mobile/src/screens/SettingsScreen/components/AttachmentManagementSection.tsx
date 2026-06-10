import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Sharing from 'expo-sharing'
import {
  AttachmentManagementView,
  useNativeTheme,
  useNativeToast,
  type SessionAttachmentGroup,
  type DiaryAttachmentFileItem
} from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useAttachmentImageLoader } from '../../../hooks/useAttachmentImageLoader'
import { toFileUri } from '../../../services/android-external-fs'

const SESSION_FETCH_LIMIT = 5000

export const AttachmentManagementSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()
  const { loadImageUri, clearImageCache } = useAttachmentImageLoader(services?.fileSystem)

  const [attachments, setAttachments] = useState<SessionAttachmentGroup[]>([])
  const [diaryAttachments, setDiaryAttachments] = useState<DiaryAttachmentFileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadSessionAttachments = useCallback(async () => {
    if (!services || !dbReady) return
    const sessions = await services.sessionManager.findAllSessions(SESSION_FETCH_LIMIT, 0)
    const activeIds = new Set<string>(sessions.map((s: { id: string }) => s.id))
    const groups = await services.attachmentManager.listSessionGroups(activeIds)
    const titleMap = new Map<string, string | undefined>(
      sessions.map((s: { id: string; title?: string }) => [s.id, s.title])
    )
    setAttachments(
      groups.map((g) => ({
        ...g,
        sessionTitle: titleMap.get(g.sessionId)
      }))
    )
  }, [services, dbReady])

  const loadDiaryAttachments = useCallback(async () => {
    if (!services || !dbReady) return
    const list = await services.attachmentManager.listDiaryAttachments()
    setDiaryAttachments(list)
  }, [services, dbReady])

  const loadAll = useCallback(async () => {
    if (!services || !dbReady) return
    setIsLoading(true)
    clearImageCache()
    try {
      await loadDiaryAttachments()
      await loadSessionAttachments()
    } catch (e) {
      console.warn('Load attachments failed', e)
      toast.showError(t('common.errors.load_failed', '加载失败'))
    } finally {
      setIsLoading(false)
    }
  }, [services, dbReady, loadDiaryAttachments, loadSessionAttachments, clearImageCache, toast, t])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleOpenFile = async (absolutePath: string) => {
    try {
      const uri = toFileUri(absolutePath)
      const canShare = await Sharing.isAvailableAsync()
      if (!canShare) {
        toast.showError(t('settings.attachment_share_unavailable', '当前设备不支持分享文件'))
        return
      }
      await Sharing.shareAsync(uri)
    } catch (e) {
      console.warn('Share file failed', e)
      toast.showError(t('common.errors.save_failed'))
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.attachment_management_desc')}
      </Text>

      <AttachmentManagementView
        attachments={attachments}
        diaryAttachments={diaryAttachments}
        isLoading={isLoading}
        onRefresh={loadAll}
        toDisplayUri={toFileUri}
        loadImageUri={loadImageUri}
        onImageCacheScopeChange={clearImageCache}
        onDeleteSelected={async (ids) => {
          await services?.attachmentManager.deleteBatch(ids)
          await loadSessionAttachments()
        }}
        onDeleteFile={async (sessionId, fileName) => {
          await services?.attachmentManager.deleteFile(sessionId, fileName)
          await loadSessionAttachments()
        }}
        onOpenFileLocation={handleOpenFile}
        onDeleteDiaryAttachment={async (filePath) => {
          await services?.attachmentManager.deleteDiaryAttachment(filePath)
          await loadDiaryAttachments()
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    flex: 1,
    minHeight: 400
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20
  }
})
