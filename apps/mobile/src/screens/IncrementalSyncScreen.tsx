import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, Alert, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { scrollIndicatorStyle, IncrementalSyncPanel, useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'

const IncrementalSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const [isConfigured, setIsConfigured] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    statusText?: string
  } | null>(null)

  const refreshConfigured = useCallback(async () => {
    if (!services?.incrementalSyncService || !dbReady) return
    setIsConfigured(await services.incrementalSyncService.isConfigured())
  }, [services, dbReady])

  useEffect(() => {
    refreshConfigured()
  }, [refreshConfigured])

  const runSync = useCallback(
    async (mode: 'sync' | 'uploadOnly' | 'downloadOnly' | 'zipBackup', title: string) => {
      if (!services?.incrementalSyncService) throw new Error('服务未就绪')

      setIsSyncing(true)
      setProgress({ current: 0, total: 1, statusText: title })

      try {
        let result
        if (mode === 'sync') {
          result = await services.incrementalSyncService.sync((p) => setProgress(p))
        } else if (mode === 'uploadOnly') {
          result = await services.incrementalSyncService.uploadOnly((p) => setProgress(p))
        } else if (mode === 'downloadOnly') {
          result = await services.incrementalSyncService.downloadOnly((p) => setProgress(p))
        } else {
          result = await services.incrementalSyncService.syncUpload((p) => setProgress(p))
        }

        Alert.alert(
          t('common.success'),
          t('incremental_sync.done_detail')
            .replace('{up}', String(result.uploaded))
            .replace('{down}', String(result.downloaded))
            .replace('{skip}', String(result.skipped))
            .replace('{conf}', String(result.conflicts))
        )
        return result
      } finally {
        setIsSyncing(false)
        setProgress(null)
      }
    },
    [services, t]
  )

  const handleSync = useCallback(async () => {
    try {
      return await runSync('sync', t('incremental_sync.three_way'))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      Alert.alert(t('common.error'), msg || t('incremental_sync.failed'))
      throw e
    }
  }, [runSync, t])

  return (
    <StackScreenLayout
      title={t('incremental_sync.title')}
      {...getStackScreenChrome(colors)}
      contentStyle={styles.layoutContent}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('incremental_sync.description')}
        </Text>

        <IncrementalSyncPanel
          onSync={handleSync}
          isConfigured={isConfigured}
          isSyncing={isSyncing}
          progress={progress}
        />

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.bgSurfaceHighest }]}
          disabled={!isConfigured || isSyncing}
          onPress={() =>
            runSync('uploadOnly', t('incremental_sync.upload_only')).catch((e) =>
              Alert.alert(t('common.error'), e instanceof Error ? e.message : '')
            )
          }
        >
          <Text style={{ color: colors.textPrimary }}>{t('incremental_sync.upload_only_btn')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.bgSurfaceHighest }]}
          disabled={!isConfigured || isSyncing}
          onPress={() =>
            runSync('downloadOnly', t('incremental_sync.download_only')).catch((e) =>
              Alert.alert(t('common.error'), e instanceof Error ? e.message : '')
            )
          }
        >
          <Text style={{ color: colors.textPrimary }}>
            {t('incremental_sync.download_only_btn')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.bgSurfaceHighest }]}
          disabled={!isConfigured || isSyncing}
          onPress={() =>
            runSync('zipBackup', t('incremental_sync.zip_backup')).catch((e) =>
              Alert.alert(t('common.error'), e instanceof Error ? e.message : '')
            )
          }
        >
          <Text style={{ color: colors.textPrimary }}>{t('incremental_sync.zip_backup_btn')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 12 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  }
})

export { IncrementalSyncScreen }
