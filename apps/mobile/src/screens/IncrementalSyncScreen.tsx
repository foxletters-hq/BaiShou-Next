import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, SafeAreaView, StatusBar, Alert, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, scrollIndicatorStyle, IncrementalSyncPanel } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

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
    async (
      mode: 'sync' | 'uploadOnly' | 'downloadOnly' | 'zipBackup',
      title: string
    ) => {
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
          t('common.success', '成功'),
          t(
            'incremental_sync.done_detail',
            '上传 {up} · 下载 {down} · 跳过 {skip} · 冲突 {conf}'
          )
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
      return await runSync('sync', t('incremental_sync.three_way', '三向合并同步...'))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      Alert.alert(t('common.error', '错误'), msg || t('incremental_sync.failed', '同步失败'))
      throw e
    }
  }, [runSync, t])

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bgApp} />
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bgApp }]}>
        <ScrollView
          style={[styles.container, { backgroundColor: colors.bgApp }]}
          indicatorStyle={scrollIndicatorStyle(isDark)}
        >
          <View
            style={[
              styles.header,
              { backgroundColor: colors.bgSurface, borderBottomColor: colors.borderSubtle }
            ]}
          >
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('incremental_sync.title', '增量同步')}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t(
                'incremental_sync.description',
                '与桌面相同的三向 manifest 同步（manifest-v2.json），配置存于 vault 根目录 .baishou-s3.json'
              )}
            </Text>
          </View>

          <View style={styles.content}>
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
                runSync('uploadOnly', t('incremental_sync.upload_only', '仅上传...')).catch((e) =>
                  Alert.alert(t('common.error', '错误'), e?.message || '')
                )
              }
            >
              <Text style={{ color: colors.textPrimary }}>
                {t('incremental_sync.upload_only_btn', '仅上传变更')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.bgSurfaceHighest }]}
              disabled={!isConfigured || isSyncing}
              onPress={() =>
                runSync('downloadOnly', t('incremental_sync.download_only', '仅下载...')).catch(
                  (e) => Alert.alert(t('common.error', '错误'), e?.message || '')
                )
              }
            >
              <Text style={{ color: colors.textPrimary }}>
                {t('incremental_sync.download_only_btn', '仅下载变更')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: colors.bgSurfaceHighest }]}
              disabled={!isConfigured || isSyncing}
              onPress={() =>
                runSync('zipBackup', t('incremental_sync.zip_backup', 'ZIP 全量备份...')).catch(
                  (e) => Alert.alert(t('common.error', '错误'), e?.message || '')
                )
              }
            >
              <Text style={{ color: colors.textPrimary }}>
                {t('incremental_sync.zip_backup_btn', 'ZIP 全量备份上传')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1
  },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4 },
  content: { flex: 1, padding: 16, gap: 12 },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8
  }
})

export { IncrementalSyncScreen }
