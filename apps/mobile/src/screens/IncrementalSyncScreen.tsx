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
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'
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
  const [saving, setSaving] = useState(false)
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

  const handleSaveConfig = useCallback(async () => {
    if (!services?.incrementalSyncService) return
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setSaving(true)
    try {
      await services.incrementalSyncService.saveConfig(projectIncrementalSyncRuntime(config))
      await refreshConfigured()
      const n = Number(thresholdText)
      if (Number.isFinite(n)) {
        const thresholdMb = Math.max(1, Math.min(10240, Math.floor(n)))
        await saveSyncTrafficSettings({ enabled: trafficSettings.enabled, thresholdMb }).catch(
          () => {}
        )
      }
      toast.showSuccess(t('common.save_success', '保存成功'))
    } catch (e: unknown) {
      toast.showError(e instanceof Error ? e.message : t('data_sync.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
  }, [config, services, t, toast, refreshConfigured, thresholdText, trafficSettings.enabled])

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
          <IncrementalSyncConfigSheet
            config={config}
            showAccessKey={showAccessKey}
            showSecretKey={showSecretKey}
            colors={colors}
            tokens={tokens}
            testing={testing}
            saving={saving}
            onChange={(next, immediate) => void handleConfigChange(next, immediate)}
            onToggleAccessKey={() => setShowAccessKey((v) => !v)}
            onToggleSecretKey={() => setShowSecretKey((v) => !v)}
            onTestConnection={() => void handleTestConnection()}
            onSave={() => void handleSaveConfig()}
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
              <Switch value={trafficSettings.enabled} onValueChange={handleTrafficEnabledChange} />
            </View>
            {trafficSettings.enabled ? (
              <>
                <Text
                  style={[
                    styles.trafficTitle,
                    { color: colors.textPrimary, marginTop: sharedTokens.spacing.mdTight }
                  ]}
                >
                  {t('settings.sync_traffic_threshold', '流量提示阈值（MB）')}
                </Text>
                <Text
                  style={[
                    styles.trafficHint,
                    { color: colors.textSecondary, marginBottom: sharedTokens.spacing.xsPlus }
                  ]}
                >
                  {t(
                    'settings.sync_traffic_threshold_hint',
                    '移动数据下，上传+下载合计超过此值才弹出警告'
                  )}
                </Text>
                <Input
                  value={thresholdText}
                  keyboardType="number-pad"
                  onChangeText={handleThresholdChange}
                  containerStyle={{ marginTop: sharedTokens.spacing.xs }}
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
  scrollContent: { padding: sharedTokens.spacing.md, paddingBottom: sharedTokens.spacing.mdPlus },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: sharedTokens.spacing.md,
    gap: sharedTokens.spacing.xs
  },
  actionDivider: {
    height: 1,
    marginTop: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.mdTight
  },
  trafficSection: {
    gap: sharedTokens.spacing.xs
  },
  trafficRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.mdTight
  },
  trafficText: {
    flex: 1,
    gap: sharedTokens.spacing.xs
  },
  trafficTitle: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  trafficHint: {
    fontSize: mobileTypography.caption.fontSize,
    lineHeight: 18
  },
  syncButton: {
    marginTop: sharedTokens.spacing.xs
  },
  progressSection: {
    marginTop: sharedTokens.spacing.mdTight
  },
  progressBarBg: {
    height: 6,
    borderRadius: sharedTokens.radius.xxs,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 6,
    borderRadius: sharedTokens.radius.xxs
  },
  progressText: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xsPlus
  }
})

export { IncrementalSyncScreen }
