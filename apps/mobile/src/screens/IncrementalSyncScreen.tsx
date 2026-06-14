import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import {
  scrollIndicatorStyle,
  KeyboardAwareScrollView,
  useNativeTheme,
  useNativeToast,
  useDialog,
  Button,
  IncrementalSyncScopeList
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
  target: 's3',
  fileConcurrency: 5,
  chunkConcurrency: 5,
  maxDivergencePercent: 100
}

const IncrementalSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()

  const [isConfigured, setIsConfigured] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showAccessKey, setShowAccessKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<S3SyncConfig>(DEFAULT_CONFIG)
  const [progress, setProgress] = useState<{
    current: number
    total: number
    statusText?: string
  } | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const persistConfig = useCallback(
    async (next: S3SyncConfig) => {
      if (!services?.incrementalSyncService) return
      try {
        await services.incrementalSyncService.saveConfig(next)
        setIsConfigured(await services.incrementalSyncService.isConfigured())
      } catch (e: unknown) {
        toast.showError(e instanceof Error ? e.message : t('data_sync.save_failed'))
      }
    },
    [services, t, toast]
  )

  const applyConfigChange = useCallback(
    (next: S3SyncConfig, immediate = false) => {
      setConfig(next)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (immediate) {
        void persistConfig(next)
      } else {
        saveTimerRef.current = setTimeout(() => void persistConfig(next), 500)
      }
    },
    [persistConfig]
  )

  const handleConfigChange = useCallback(
    async (next: S3SyncConfig, immediate = false) => {
      if (next.enabled && !config.enabled) {
        const confirmed = await dialog.confirm(t('data_sync.incremental_sync_enable_warning'), {
          title: t('data_sync.incremental_sync_enable_warning_title'),
          confirmText: t('common.confirm', '确认'),
          cancelText: t('common.cancel', '取消')
        })
        if (!confirmed) return
      }
      applyConfigChange(next, immediate)
    },
    [applyConfigChange, config.enabled, dialog, t]
  )

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
    >
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle,
              borderRadius: tokens.radius.lg
            }
          ]}
        >
          <Text style={[styles.intro, { color: colors.textSecondary }]}>
            {t('data_sync.incremental_sync_tooltip')}
          </Text>

          <IncrementalSyncScopeList />

          <View style={[styles.cardDivider, { backgroundColor: colors.borderMuted }]} />

          <IncrementalSyncConfigSheet
            config={config}
            showAccessKey={showAccessKey}
            showSecretKey={showSecretKey}
            colors={colors}
            tokens={tokens}
            testing={testing}
            onChange={(next, immediate) => void handleConfigChange(next, immediate)}
            onToggleAccessKey={() => setShowAccessKey((v) => !v)}
            onToggleSecretKey={() => setShowSecretKey((v) => !v)}
            onTestConnection={() => void handleTestConnection()}
          />

          {config.enabled ? (
            <>
              <View style={[styles.actionDivider, { backgroundColor: colors.borderMuted }]} />
              <Button
                variant="primary"
                onPress={handleSync}
                isDisabled={!isConfigured || isSyncing}
                isLoading={isSyncing}
                style={styles.syncButton}
              >
                {isSyncing ? t('data_sync.syncing') : t('data_sync.sync_now', '同步')}
              </Button>

              {isSyncing && progress && progress.total > 0 ? (
                <View style={styles.progressSection}>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.bgSurfaceNormal }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${Math.round((progress.current / progress.total) * 100)}%`
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    {progress.current}/{progress.total}
                    {progress.statusText ? ` · ${progress.statusText}` : ''}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4
  },
  intro: { fontSize: 14, lineHeight: 22 },
  cardDivider: {
    height: 1,
    marginVertical: 14
  },
  actionDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 12
  },
  syncButton: {
    marginTop: 4
  },
  progressSection: {
    marginTop: 12
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3
  },
  progressText: {
    fontSize: 12,
    marginTop: 6
  }
})

export { IncrementalSyncScreen }
