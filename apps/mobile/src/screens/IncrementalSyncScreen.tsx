import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import { DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH } from '@baishou/shared'
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
import { useIncrementalSync } from '../providers/IncrementalSyncProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { IncrementalSyncConfigSheet } from './IncrementalSyncConfigSheet'

const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: 'us-east-1',
  bucket: '',
  path: DEFAULT_INCREMENTAL_SYNC_CLOUD_PATH,
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
  const { isSyncing, isConfigured, refreshConfigured, runIncrementalSync } = useIncrementalSync()

  const [showAccessKey, setShowAccessKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<S3SyncConfig>(DEFAULT_CONFIG)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadConfig = useCallback(async () => {
    if (!services?.incrementalSyncService || !dbReady) return
    try {
      setConfig(await services.incrementalSyncService.getConfig())
    } catch {
      setConfig(DEFAULT_CONFIG)
    }
  }, [services, dbReady])

  useEffect(() => {
    void refreshConfigured()
    void loadConfig()
  }, [refreshConfigured, loadConfig])

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
        await refreshConfigured()
      } catch (e: unknown) {
        toast.showError(e instanceof Error ? e.message : t('data_sync.save_failed'))
      }
    },
    [services, t, toast, refreshConfigured]
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

  const handleSync = useCallback(async () => {
    try {
      await runIncrementalSync('sync')
    } catch {
      // 错误提示由全局同步 Provider 处理
    }
  }, [runIncrementalSync])

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
                isDisabled={isConfigured !== true || isSyncing}
                isLoading={isSyncing}
                style={styles.syncButton}
              >
                {isSyncing ? t('data_sync.syncing') : t('data_sync.sync_now', '同步')}
              </Button>
            </>
          ) : null}

          <IncrementalSyncScopeList />
        </View>
      </KeyboardAwareScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 20 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4
  },
  intro: { fontSize: 14, lineHeight: 22 },
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
