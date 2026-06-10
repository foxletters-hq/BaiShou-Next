import React, { useCallback, useEffect, useState } from 'react'
import { Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import {
  scrollIndicatorStyle,
  IncrementalSyncPanel,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { IncrementalSyncConfigSheet } from './IncrementalSyncConfigSheet'

const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  path: 'backup_sync',
  accessKey: '',
  secretKey: '',
  target: 's3'
}

const IncrementalSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const { services, dbReady } = useBaishou()

  const [isConfigured, setIsConfigured] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<S3SyncConfig>(DEFAULT_CONFIG)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    statusText?: string
  } | null>(null)

  const refreshConfigured = useCallback(async () => {
    if (!services?.incrementalSyncService || !dbReady) return
    const svc = services.incrementalSyncService
    setIsConfigured(await svc.isConfigured())
    try {
      setConfig(await svc.getConfig())
    } catch {
      setConfig(DEFAULT_CONFIG)
    }
  }, [services, dbReady])

  useEffect(() => {
    refreshConfigured()
  }, [refreshConfigured])

  const runSync = useCallback(
    async (mode: 'sync' | 'uploadOnly' | 'downloadOnly' | 'zipBackup', title: string) => {
      if (!services?.incrementalSyncService) throw new Error(t('workspace.service_unavailable'))

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

        toast.showSuccess(
          t('data_sync.sync_result_uploaded').replace('$count', String(result.uploaded)) +
            ' / ' +
            t('data_sync.sync_result_downloaded').replace('$count', String(result.downloaded))
        )
        return result
      } finally {
        setIsSyncing(false)
        setProgress(null)
      }
    },
    [services, t, toast]
  )

  const handleSync = useCallback(async () => {
    try {
      return await runSync('sync', t('data_sync.syncing'))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.showError(msg || t('data_sync.sync_failed_generic'))
      throw e
    }
  }, [runSync, t, toast])

  const handleSaveConfig = useCallback(async () => {
    if (!services?.incrementalSyncService) return
    try {
      await services.incrementalSyncService.saveConfig(config)
      await refreshConfigured()
      setConfigOpen(false)
      toast.showSuccess(t('data_sync.config_saved', '配置已保存'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('data_sync.save_failed'))
    }
  }, [config, refreshConfigured, services, t, toast])

  const handleTestConnection = useCallback(async () => {
    if (!services?.incrementalSyncService) return
    setTesting(true)
    try {
      await services.incrementalSyncService.testConnection(config)
      toast.showSuccess(t('data_sync.connection_success', '连接成功'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('data_sync.connection_failed'))
    } finally {
      setTesting(false)
    }
  }, [config, services, t, toast])

  return (
    <StackScreenLayout
      title={t('data_sync.incremental_sync')}
      {...getStackScreenChrome(colors)}
      contentStyle={styles.layoutContent}
      headerRight={{
        icon: 'settings',
        onPress: () => setConfigOpen(true),
        accessibilityLabel: t('data_sync.config_section')
      }}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('data_sync.incremental_sync_desc')}
        </Text>

        <IncrementalSyncPanel
          onSync={handleSync}
          isConfigured={isConfigured}
          isSyncing={isSyncing}
          progress={progress}
        />

        <TouchableOpacity
          style={[styles.configLink, { borderColor: colors.borderMuted }]}
          onPress={() => setConfigOpen(true)}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('data_sync.config_section')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <IncrementalSyncConfigSheet
        visible={configOpen}
        config={config}
        showPassword={showPassword}
        colors={colors}
        tokens={tokens}
        testing={testing}
        onChange={setConfig}
        onTogglePassword={() => setShowPassword((v) => !v)}
        onTestConnection={() => void handleTestConnection()}
        onSave={() => void handleSaveConfig()}
        onClose={() => setConfigOpen(false)}
      />
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
  },
  configLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8
  }
})

export { IncrementalSyncScreen }
