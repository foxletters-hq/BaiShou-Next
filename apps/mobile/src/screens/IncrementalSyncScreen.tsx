import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { S3SyncConfig } from '@baishou/shared'
import { DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB } from '@baishou/shared'
import {
  scrollIndicatorStyle,
  KeyboardAwareScrollView,
  useNativeTheme,
  useNativeToast,
  useDialog,
  Button,
  IncrementalSyncScopeList,
  Switch,
  Input
} from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { useIncrementalSync } from '../providers/IncrementalSyncProvider'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import { IncrementalSyncConfigSheet } from './IncrementalSyncConfigSheet'
import { useIncrementalSyncNavigationGuard } from '../hooks/useIncrementalSyncNavigationGuard'
import {
  DEFAULT_CONFIG,
  projectIncrementalSyncRuntime
} from '../services/mobile-incremental-sync-config.util'
import {
  getSyncTrafficSettings,
  saveSyncTrafficSettings,
  type SyncTrafficSettings
} from '../services/mobile-sync-traffic-settings.service'

const IncrementalSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const { isSyncing, isPlanning, isBusy, isConfigured, refreshConfigured, runIncrementalSync } =
    useIncrementalSync()

  useIncrementalSyncNavigationGuard()

  const [showAccessKey, setShowAccessKey] = useState(false)
  const [showSecretKey, setShowSecretKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [config, setConfig] = useState<S3SyncConfig>(DEFAULT_CONFIG)
  const [trafficSettings, setTrafficSettings] = useState<SyncTrafficSettings>({
    enabled: true,
    thresholdMb: DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB
  })
  const [thresholdText, setThresholdText] = useState(String(DEFAULT_SYNC_TRAFFIC_THRESHOLD_MB))
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadConfig = useCallback(async () => {
    if (!services?.incrementalSyncService || !dbReady) return
    try {
      setConfig(await services.incrementalSyncService.getConfig())
    } catch {
      setConfig(DEFAULT_CONFIG)
    }
  }, [services, dbReady])

  const loadTrafficSettings = useCallback(async () => {
    try {
      const next = await getSyncTrafficSettings()
      setTrafficSettings(next)
      setThresholdText(String(next.thresholdMb))
    } catch {
      // keep defaults
    }
  }, [])

  useEffect(() => {
    void refreshConfigured()
    void loadConfig()
    void loadTrafficSettings()
  }, [refreshConfigured, loadConfig, loadTrafficSettings])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const persistConfig = useCallback(
    async (next: S3SyncConfig) => {
      if (!services?.incrementalSyncService) return
      try {
        await services.incrementalSyncService.saveConfig(projectIncrementalSyncRuntime(next))
        await refreshConfigured()
      } catch (e: unknown) {
        toast.showError(e instanceof Error ? e.message : t('data_sync.save_failed'))
      }
    },
    [services, t, toast, refreshConfigured]
  )

  const applyConfigChange = useCallback(
    (next: S3SyncConfig, immediate = false) => {
      const projected = projectIncrementalSyncRuntime(next)
      setConfig(projected)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (immediate) {
        void persistConfig(projected)
      } else {
        saveTimerRef.current = setTimeout(() => void persistConfig(projected), 500)
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

  const handleTrafficEnabledChange = useCallback(
    (enabled: boolean) => {
      setTrafficSettings((prev) => ({ ...prev, enabled }))
      void saveSyncTrafficSettings({ enabled }).catch(() => {
        toast.showError(t('data_sync.save_failed'))
      })
    },
    [t, toast]
  )

  const handleThresholdChange = useCallback(
    (text: string) => {
      setThresholdText(text)
      const n = Number(text)
      if (!Number.isFinite(n)) return
      const thresholdMb = Math.max(1, Math.min(10240, Math.floor(n)))
      setTrafficSettings((prev) => ({ ...prev, thresholdMb }))
      void saveSyncTrafficSettings({ thresholdMb }).catch(() => {
        toast.showError(t('data_sync.save_failed'))
      })
    },
    [t, toast]
  )

  const handleSync = useCallback(async () => {
    try {
      await runIncrementalSync()
    } catch {
      // 错误提示由全局同步 Provider 处理
    }
  }, [runIncrementalSync])

  const handleTestConnection = useCallback(async () => {
    if (!services?.incrementalSyncService) return
    setTesting(true)
    try {
      await services.incrementalSyncService.testConnection(projectIncrementalSyncRuntime(config))
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

          <View style={[styles.actionDivider, { backgroundColor: colors.borderMuted }]} />
          <View style={styles.trafficSection}>
            <View style={styles.trafficRow}>
              <View style={styles.trafficText}>
                <Text style={[styles.trafficTitle, { color: colors.textPrimary }]}>
                  {t('settings.sync_traffic_enabled', '同步流量提示')}
                </Text>
                <Text style={[styles.trafficHint, { color: colors.textSecondary }]}>
                  {t(
                    'settings.sync_traffic_enabled_hint',
                    '在移动数据下超过阈值时提示流量用量；Wi-Fi 下不会打扰'
                  )}
                </Text>
              </View>
              <Switch
                value={trafficSettings.enabled}
                onValueChange={handleTrafficEnabledChange}
              />
            </View>
            {trafficSettings.enabled ? (
              <>
                <Text style={[styles.trafficTitle, { color: colors.textPrimary, marginTop: 12 }]}>
                  {t('settings.sync_traffic_threshold', '流量提示阈值（MB）')}
                </Text>
                <Text style={[styles.trafficHint, { color: colors.textSecondary, marginBottom: 6 }]}>
                  {t(
                    'settings.sync_traffic_threshold_hint',
                    '移动数据下，上传+下载合计超过此值才弹出警告'
                  )}
                </Text>
                <Input
                  value={thresholdText}
                  keyboardType="number-pad"
                  onChangeText={handleThresholdChange}
                  containerStyle={{ marginTop: 4 }}
                />
              </>
            ) : null}
          </View>

          {config.enabled ? (
            <>
              <View style={[styles.actionDivider, { backgroundColor: colors.borderMuted }]} />
              <Button
                variant="primary"
                onPress={handleSync}
                isDisabled={isConfigured !== true || isBusy}
                isLoading={isSyncing || isPlanning}
                style={styles.syncButton}
              >
                {isSyncing
                  ? t('data_sync.syncing')
                  : isPlanning
                    ? t('data_sync.planning', '正在分析同步变更…')
                    : t('data_sync.sync_now', '同步')}
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
  trafficSection: {
    gap: 4
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  trafficText: {
    flex: 1,
    gap: 4
  },
  trafficTitle: {
    fontSize: 15,
    fontWeight: '600'
  },
  trafficHint: {
    fontSize: 12,
    lineHeight: 18
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
