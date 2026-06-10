import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import {
  useNativeTheme,
  useNativeToast,
  useDialog,
  scrollIndicatorStyle,
  Input,
  RestoreBlockingOverlay
} from '@baishou/ui/native'
import { logger } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'
import { useTranslation } from 'react-i18next'
import { SyncConfig, SyncRecord } from '@baishou/core-mobile'
import { DataSyncSnapshotPanel } from './DataSyncSnapshotPanel'
import { StackScreenLayout } from '../components/StackScreenLayout'
import { getStackScreenChrome } from '../components/stackScreenChrome'
import {
  DEFAULT_SYNC_CONFIG,
  migrateLegacySyncTargets,
  type LegacySyncTarget
} from './dataSyncDefaults'
import { DataSyncCountModal } from './DataSyncCountModal'
import { DataSyncConfigSheet } from './DataSyncConfigSheet'
import { useArchiveImportExport } from '../hooks/useArchiveImportExport'
import { ArchiveLocalBackupSection } from './DataSyncScreen/ArchiveLocalBackupSection'

export const DataSyncScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth, isDark } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()

  const [syncConfig, setSyncConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG)
  const [configDraft, setConfigDraft] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG)
  const [configLoaded, setConfigLoaded] = useState(false)

  const [cloudRecords, setCloudRecords] = useState<SyncRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsRefreshing, setRecordsRefreshing] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [renamingRecord, setRenamingRecord] = useState<string | null>(null)
  const [newRecordName, setNewRecordName] = useState('')
  const [backupTab, setBackupTab] = useState<'cloud' | 'snapshot'>('cloud')
  const [showCountModal, setShowCountModal] = useState(false)
  const [tempCount, setTempCount] = useState(20)
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [showPasswordInConfig, setShowPasswordInConfig] = useState(false)

  const noLimitLabel = t('data_sync.no_limit', '不限制数量')
  const cloudSyncService = services?.cloudSyncService
  const {
    handleExport: handleArchiveExport,
    handleImport: handleArchiveImport,
    isImporting: isArchiveImporting
  } = useArchiveImportExport()

  const totalSizeString = useMemo(() => {
    const total = cloudRecords.reduce((sum, r) => sum + r.sizeInBytes, 0)
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`
    return `${(total / (1024 * 1024)).toFixed(2)} MB`
  }, [cloudRecords])

  const getTargetIconName = (type: string): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case 'webdav':
        return 'language'
      case 's3':
        return 'cloud'
      default:
        return 'folder'
    }
  }

  const getTargetColor = (type: string) => {
    switch (type) {
      case 'webdav':
        return '#0ea5e9'
      case 's3':
        return '#f59e0b'
      default:
        return '#10b981'
    }
  }

  const persistConfig = useCallback(
    async (config: SyncConfig) => {
      if (!services) return
      await services.settingsManager.set('cloud_sync_config', config)
    },
    [services]
  )

  const loadConfig = useCallback(async () => {
    if (!dbReady || !services) return
    try {
      let saved = (await services.settingsManager.get<SyncConfig>('cloud_sync_config')) ?? undefined
      if (!saved) {
        const legacy = await services.settingsManager.get<LegacySyncTarget[]>('sync_targets')
        if (legacy?.length) {
          const migrated = migrateLegacySyncTargets(legacy)
          if (migrated) {
            saved = migrated
            await persistConfig(migrated)
          }
        }
      }
      const next = { ...DEFAULT_SYNC_CONFIG, ...(saved || {}) }
      setSyncConfig(next)
      setConfigDraft(next)
    } catch (e) {
      logger.error('加载备份配置失败', e instanceof Error ? e : String(e))
    } finally {
      setConfigLoaded(true)
    }
  }, [dbReady, services, persistConfig])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const fetchCloudRecords = useCallback(async () => {
    if (!cloudSyncService || syncConfig.target === 'local') {
      setCloudRecords([])
      return
    }
    setRecordsLoading(true)
    try {
      const records = await cloudSyncService.listRecords(syncConfig)
      setCloudRecords(records)
    } catch (e) {
      logger.error('加载云端记录失败', e instanceof Error ? e : String(e))
      toast.showError(t('data_sync.load_records_failed'))
    } finally {
      setRecordsLoading(false)
      setIsMultiSelectMode(false)
      setSelectedRecords(new Set())
    }
  }, [cloudSyncService, syncConfig, t, toast])

  useEffect(() => {
    if (!configLoaded || backupTab !== 'cloud') return
    void fetchCloudRecords()
  }, [configLoaded, backupTab, syncConfig, fetchCloudRecords])

  const handleRefreshRecords = useCallback(async () => {
    setRecordsRefreshing(true)
    await fetchCloudRecords()
    setRecordsRefreshing(false)
  }, [fetchCloudRecords])

  const showHelp = () => {
    void dialog.alert(
      backupTab === 'snapshot' ? t('data_sync.snapshot_tooltip') : t('data_sync.backup_tooltip'),
      backupTab === 'snapshot'
        ? t('data_sync.local_snapshots_tab')
        : t('data_sync.sync_records', '云端备份')
    )
  }

  const openCountModal = () => {
    if (backupTab === 'snapshot') {
      setTempCount(syncConfig.maxSnapshotCount === -1 ? 5 : (syncConfig.maxSnapshotCount ?? 5))
    } else {
      setTempCount(syncConfig.maxBackupCount === -1 ? 20 : syncConfig.maxBackupCount)
    }
    setShowCountModal(true)
  }

  const confirmCountModal = async () => {
    const field = backupTab === 'snapshot' ? 'maxSnapshotCount' : 'maxBackupCount'
    const next = { ...syncConfig, [field]: tempCount }
    setSyncConfig(next)
    await persistConfig(next)
    setShowCountModal(false)
    toast.showSuccess(t('data_sync.config_saved', '配置已保存'))
  }

  const openSettings = () => {
    setConfigDraft({ ...syncConfig })
    setShowPasswordInConfig(false)
    setShowConfigForm(true)
  }

  const handleSaveConfig = async () => {
    setSyncConfig(configDraft)
    await persistConfig(configDraft)
    setShowConfigForm(false)
    toast.showSuccess(t('data_sync.config_saved', '配置已保存'))
    await fetchCloudRecords()
  }

  const handleRestoreRecord = useCallback(
    async (filename: string) => {
      const confirmed = await dialog.confirm(t('data_sync.cloud_restore_warning'), {
        title: t('data_sync.confirm_cloud_restore'),
        confirmText: t('common.confirm')
      })
      if (!confirmed || !cloudSyncService) return
      setIsRestoring(true)
      try {
        const result = await cloudSyncService.restoreFromCloud(syncConfig, filename)
        toast.showSuccess(result.message)
      } catch (e) {
        logger.error('云端恢复失败', e instanceof Error ? e : String(e))
        toast.showError(t('data_sync.restore_failed'))
      } finally {
        setIsRestoring(false)
      }
    },
    [cloudSyncService, dialog, syncConfig, t, toast]
  )

  const handleDeleteCloudRecord = useCallback(
    async (filename: string) => {
      const confirmed = await dialog.confirm(
        t('data_sync.delete_record_warning', { name: filename }),
        {
          title: t('data_sync.confirm_delete_record'),
          confirmText: t('common.delete'),
          destructive: true
        }
      )
      if (!confirmed || !cloudSyncService) return
      try {
        await cloudSyncService.deleteRecord(syncConfig, filename)
        setCloudRecords((prev) => prev.filter((r) => r.filename !== filename))
        toast.showSuccess(t('data_sync.record_deleted'))
      } catch (e) {
        logger.error('删除云端记录失败', e instanceof Error ? e : String(e))
        toast.showError(t('data_sync.delete_record_failed'))
      }
    },
    [cloudSyncService, dialog, syncConfig, t, toast]
  )

  const handleBatchDeleteRecords = useCallback(async () => {
    const filenames = Array.from(selectedRecords)
    if (filenames.length === 0) return

    const confirmed = await dialog.confirm(
      t('data_sync.batch_delete_warning', { count: filenames.length }),
      {
        title: t('data_sync.confirm_batch_delete'),
        confirmText: t('common.delete'),
        destructive: true
      }
    )
    if (!confirmed || !cloudSyncService) return
    try {
      const deleted = await cloudSyncService.batchDeleteRecords(syncConfig, filenames)
      setCloudRecords((prev) => prev.filter((r) => !selectedRecords.has(r.filename)))
      setSelectedRecords(new Set())
      setIsMultiSelectMode(false)
      toast.showSuccess(t('data_sync.batch_deleted', { count: deleted }))
    } catch (e) {
      logger.error('批量删除云端记录失败', e instanceof Error ? e : String(e))
      toast.showError(t('data_sync.batch_delete_failed'))
    }
  }, [cloudSyncService, dialog, selectedRecords, syncConfig, t, toast])

  const handleRenameRecord = useCallback(
    async (oldName: string) => {
      if (!newRecordName.trim()) {
        toast.showWarning(t('data_sync.name_required'))
        return
      }
      if (!cloudSyncService) return
      try {
        await cloudSyncService.renameRecord(syncConfig, oldName, newRecordName.trim())
        setCloudRecords((prev) =>
          prev.map((r) => (r.filename === oldName ? { ...r, filename: newRecordName.trim() } : r))
        )
        setRenamingRecord(null)
        setNewRecordName('')
        toast.showSuccess(t('data_sync.record_renamed'))
      } catch (e) {
        logger.error('重命名云端记录失败', e instanceof Error ? e : String(e))
        toast.showError(t('data_sync.rename_failed'))
      }
    },
    [cloudSyncService, syncConfig, newRecordName, t, toast]
  )

  const toggleRecordSelection = useCallback((filename: string) => {
    setSelectedRecords((prev) => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }, [])

  const formatSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [])

  const handleSyncNow = async () => {
    if (!cloudSyncService || !services) return
    if (syncConfig.target === 'local') {
      toast.showWarning(
        t('cloud.sync_target_local_hint', '当前备份目标为本地，请先在备份设置中配置云端存储')
      )
      return
    }

    setIsSyncing(true)
    try {
      const result = await cloudSyncService.syncNow(syncConfig)
      if (result.success) {
        toast.showSuccess(result.message)
        await fetchCloudRecords()
      } else {
        toast.showError(result.message)
      }
    } catch (e) {
      logger.error('同步失败', e instanceof Error ? e : String(e))
      toast.showError(t('data_sync.sync_failed'))
    } finally {
      setIsSyncing(false)
    }
  }

  const maxCountLabel =
    backupTab === 'snapshot'
      ? syncConfig.maxSnapshotCount === -1
        ? noLimitLabel
        : t('data_sync.max_backup_count_value', '保留: $count').replace(
            '$count',
            String(syncConfig.maxSnapshotCount ?? 5)
          )
      : syncConfig.maxBackupCount === -1
        ? noLimitLabel
        : t('data_sync.max_backup_count_value', '保留: $count').replace(
            '$count',
            String(syncConfig.maxBackupCount)
          )

  const renderHeaderActions = () => (
    <View style={styles.headerActionsGroup}>
      {backupTab === 'cloud' && (
        <>
          {isMultiSelectMode ? (
            <>
              <TouchableOpacity
                style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
                onPress={() => {
                  if (selectedRecords.size === cloudRecords.length) setSelectedRecords(new Set())
                  else setSelectedRecords(new Set(cloudRecords.map((r) => r.filename)))
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {selectedRecords.size === cloudRecords.length
                    ? t('settings.attachment_deselect_all', '取消全选')
                    : t('settings.attachment_select_all', '全选')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsMultiSelectMode(false)
                  setSelectedRecords(new Set())
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerActionBtn,
                  { backgroundColor: colors.error, borderColor: colors.error }
                ]}
                onPress={handleBatchDeleteRecords}
                disabled={selectedRecords.size === 0}
              >
                <MaterialIcons name="delete" size={14} color={colors.textOnPrimary} />
                <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '600' }}>
                  {' '}
                  {t('common.delete')} ({selectedRecords.size})
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => {
                setIsMultiSelectMode(true)
                setSelectedRecords(new Set())
              }}
              disabled={cloudRecords.length === 0 || recordsLoading}
            >
              <MaterialIcons
                name="check-box-outline-blank"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {' '}
                {t('data_sync.batch_manage', '批量管理')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
            onPress={openSettings}
          >
            <MaterialIcons name="settings" size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {' '}
              {t('data_sync.sync_settings_button', '备份设置')}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
        onPress={openCountModal}
      >
        <MaterialIcons name="inventory-2" size={14} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
          {' '}
          {maxCountLabel}
        </Text>
      </TouchableOpacity>

      {backupTab === 'cloud' && (
        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={handleSyncNow}
          disabled={isSyncing || syncConfig.target === 'local'}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <MaterialIcons name="cloud-upload" size={14} color={colors.textOnPrimary} />
          )}
          <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '700' }}>
            {' '}
            {isSyncing
              ? t('data_sync.syncing_status', '备份中...')
              : t('data_sync.sync_now_button', '立即备份')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )

  if (showConfigForm) {
    return (
      <DataSyncConfigSheet
        visible
        config={configDraft}
        showPassword={showPasswordInConfig}
        colors={colors}
        tokens={tokens}
        onChange={setConfigDraft}
        onTogglePassword={() => setShowPasswordInConfig((v) => !v)}
        onSave={() => void handleSaveConfig()}
        onClose={() => setShowConfigForm(false)}
      />
    )
  }

  return (
    <>
      <RestoreBlockingOverlay visible={isRestoring || isArchiveImporting} />
      <StackScreenLayout
        title={t('data_sync.title')}
        {...getStackScreenChrome(colors)}
        contentStyle={styles.container}
      >
        <ScrollView style={styles.content} indicatorStyle={scrollIndicatorStyle(isDark)}>
          <ArchiveLocalBackupSection
            onExport={handleArchiveExport}
            onImport={handleArchiveImport}
          />

          {backupTab === 'cloud' && (
            <View
              style={[
                styles.statCardsRow,
                { backgroundColor: colors.bgSurface, borderColor: colors.borderSubtle }
              ]}
            >
              <View style={styles.statCard}>
                <View
                  style={[
                    styles.statIconWrapper,
                    { backgroundColor: getTargetColor(syncConfig.target) + '15' }
                  ]}
                >
                  <MaterialIcons
                    name={getTargetIconName(syncConfig.target)}
                    size={20}
                    color={getTargetColor(syncConfig.target)}
                  />
                </View>
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('data_sync.sync_target', '备份目标')}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {syncConfig.target.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                  <MaterialIcons name="storage" size={20} color="#10b981" />
                </View>
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('data_sync.total_backup_size', '总备份大小')}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {totalSizeString}
                  </Text>
                </View>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                  <MaterialIcons name="history" size={20} color="#a855f7" />
                </View>
                <View style={styles.statInfo}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    {t('data_sync.backup_count', '备份数量')}
                  </Text>
                  <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                    {cloudRecords.length}{' '}
                    <Text style={{ fontSize: 13, fontWeight: 'normal' }}>
                      {t('common.copies_unit', '份')}
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View
            style={[styles.section, { backgroundColor: colors.bgSurface, paddingVertical: 12 }]}
          >
            <View style={[styles.backupTabBar, { backgroundColor: colors.bgSurfaceHighest }]}>
              <TouchableOpacity
                style={[
                  styles.backupTab,
                  backupTab === 'cloud' && { backgroundColor: colors.bgSurface }
                ]}
                onPress={() => setBackupTab('cloud')}
              >
                <Text
                  style={{
                    color: backupTab === 'cloud' ? colors.primary : colors.textSecondary,
                    fontWeight: backupTab === 'cloud' ? '600' : '400'
                  }}
                >
                  {t('data_sync.cloud_backups_tab')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.backupTab,
                  backupTab === 'snapshot' && { backgroundColor: colors.bgSurface }
                ]}
                onPress={() => setBackupTab('snapshot')}
              >
                <Text
                  style={{
                    color: backupTab === 'snapshot' ? colors.primary : colors.textSecondary,
                    fontWeight: backupTab === 'snapshot' ? '600' : '400'
                  }}
                >
                  {t('data_sync.local_snapshots_tab')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.headerTitleRow}>
              <View style={styles.headerTitleBlock}>
                <Text style={[styles.headerTitleLabel, { color: colors.textPrimary }]}>
                  {backupTab === 'snapshot'
                    ? t('data_sync.local_snapshots', '本地快照')
                    : t('data_sync.sync_records', '云端备份')}
                </Text>
                <TouchableOpacity onPress={showHelp} hitSlop={8}>
                  <MaterialIcons name="help-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                {backupTab === 'cloud' && (
                  <View style={[styles.targetBadge, { borderColor: colors.primary }]}>
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                      {syncConfig.target.toUpperCase()}
                    </Text>
                  </View>
                )}
                {backupTab === 'cloud' && (
                  <TouchableOpacity
                    onPress={() => void fetchCloudRecords()}
                    disabled={recordsLoading}
                    hitSlop={8}
                  >
                    <MaterialIcons name="refresh" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {renderHeaderActions()}
          </View>

          {backupTab === 'snapshot' ? <DataSyncSnapshotPanel /> : null}

          {backupTab === 'cloud' && (
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              {recordsLoading && cloudRecords.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.primary} />
                  <Text
                    style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}
                  >
                    {t('data_sync.loading_records', '正在连线获取云端记录...')}
                  </Text>
                </View>
              ) : cloudRecords.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons
                    name="inventory-2"
                    size={48}
                    color={colors.textTertiary}
                    style={{ opacity: 0.5 }}
                  />
                  {syncConfig.target === 'local' ? (
                    <>
                      <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
                        {t('data_sync.local_target_no_cloud_records')}
                      </Text>
                      <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                        {t('data_sync.local_target_no_cloud_records_desc')}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {t('data_sync.no_records_hint', '暂无备份记录')}
                    </Text>
                  )}
                </View>
              ) : (
                <ScrollView
                  nestedScrollEnabled
                  refreshControl={
                    <RefreshControl
                      refreshing={recordsRefreshing}
                      onRefresh={handleRefreshRecords}
                      colors={[colors.primary]}
                      tintColor={colors.primary}
                    />
                  }
                >
                  {cloudRecords.map((record) => (
                    <View
                      key={record.filename}
                      style={[
                        styles.recordItem,
                        { backgroundColor: colors.bgSurfaceHighest },
                        selectedRecords.has(record.filename) && {
                          borderColor: colors.primary,
                          borderWidth: 2
                        }
                      ]}
                    >
                      {isMultiSelectMode && (
                        <TouchableOpacity
                          style={[
                            styles.checkbox,
                            {
                              borderColor: colors.borderSubtle,
                              backgroundColor: selectedRecords.has(record.filename)
                                ? colors.primary
                                : 'transparent'
                            }
                          ]}
                          onPress={() => toggleRecordSelection(record.filename)}
                        >
                          {selectedRecords.has(record.filename) && (
                            <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>
                              ✓
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {renamingRecord === record.filename ? (
                        <View style={styles.renameContainer}>
                          <Input
                            value={newRecordName}
                            onChangeText={setNewRecordName}
                            placeholder={t('data_sync.new_name_placeholder')}
                            autoFocus
                          />
                          <TouchableOpacity
                            style={[styles.renameConfirm, { backgroundColor: colors.primary }]}
                            onPress={() => void handleRenameRecord(record.filename)}
                          >
                            <Text
                              style={[styles.renameConfirmText, { color: colors.textOnPrimary }]}
                            >
                              {t('common.confirm')}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.renameCancel}
                            onPress={() => {
                              setRenamingRecord(null)
                              setNewRecordName('')
                            }}
                          >
                            <Text
                              style={[styles.renameCancelText, { color: colors.textSecondary }]}
                            >
                              {t('common.cancel')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <>
                          <MaterialIcons
                            name="description"
                            size={22}
                            color={colors.primary}
                            style={{ marginRight: 10, opacity: 0.85 }}
                          />
                          <View style={styles.recordInfo}>
                            <Text
                              style={[styles.recordName, { color: colors.textPrimary }]}
                              numberOfLines={1}
                            >
                              {record.filename}
                              {!record.managed && (
                                <Text style={{ color: colors.primary, fontSize: 11 }}>
                                  {' '}
                                  {t('cloud.unmanaged_label', '手动')}
                                </Text>
                              )}
                            </Text>
                            <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                              {new Date(record.lastModified).toLocaleString()} ·{' '}
                              {formatSize(record.sizeInBytes)}
                            </Text>
                          </View>

                          {!isMultiSelectMode && (
                            <View style={styles.recordActions}>
                              <TouchableOpacity
                                style={[
                                  styles.recordAction,
                                  { backgroundColor: colors.primaryLight }
                                ]}
                                onPress={() => handleRestoreRecord(record.filename)}
                              >
                                <Text style={[styles.recordActionText, { color: colors.primary }]}>
                                  {t('data_sync.restore')}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.recordAction,
                                  { backgroundColor: colors.secondaryContainer }
                                ]}
                                onPress={() => {
                                  setRenamingRecord(record.filename)
                                  setNewRecordName(record.filename)
                                }}
                              >
                                <Text
                                  style={[
                                    styles.recordActionText,
                                    { color: colors.onSecondaryContainer }
                                  ]}
                                >
                                  {t('data_sync.rename')}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.recordAction,
                                  { backgroundColor: colors.errorContainer }
                                ]}
                                onPress={() => handleDeleteCloudRecord(record.filename)}
                              >
                                <Text style={[styles.recordActionText, { color: colors.error }]}>
                                  {t('common.delete')}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </ScrollView>

        <DataSyncCountModal
          visible={showCountModal}
          activeTab={backupTab}
          tempCount={tempCount}
          noLimitLabel={noLimitLabel}
          colors={colors}
          maxModalWidth={maxModalWidth}
          onChangeCount={setTempCount}
          onConfirm={() => void confirmCountModal()}
          onClose={() => setShowCountModal(false)}
        />
      </StackScreenLayout>
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  statCardsRow: {
    flexDirection: 'column',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16
  },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statInfo: { flex: 1 },
  statLabel: { fontSize: 12, marginBottom: 3 },
  statValue: { fontSize: 17, fontWeight: '600' },
  backupTabBar: { flexDirection: 'row', borderRadius: 10, padding: 4, marginBottom: 12 },
  backupTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  headerTitleRow: { marginBottom: 10 },
  headerTitleBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  headerTitleLabel: { fontSize: 16, fontWeight: '700' },
  targetBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1
  },
  headerActionsGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1
  },
  emptyContainer: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  emptySubText: { fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  loadingContainer: { alignItems: 'center', padding: 32 },
  loadingText: { fontSize: 14 },
  recordItem: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkmark: { fontSize: 14, fontWeight: '700' },
  recordInfo: { flex: 1 },
  recordName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recordMeta: { fontSize: 11 },
  recordActions: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  recordAction: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  recordActionText: { fontSize: 11, fontWeight: '600' },
  renameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  renameConfirm: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  renameConfirmText: { fontSize: 13, fontWeight: '600' },
  renameCancel: { padding: 8 },
  renameCancelText: { fontSize: 13, fontWeight: '600' }
})
