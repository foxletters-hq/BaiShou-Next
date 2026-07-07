import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { logger, isRemoteCloudSyncConfigured } from '@baishou/shared'
import { useBaishou } from '../../../providers/BaishouProvider'
import { SyncConfig, SyncRecord } from '@baishou/core-mobile'
import {
  DEFAULT_SYNC_CONFIG,
  getCloudSyncFetchKey,
  migrateLegacySyncTargets,
  type LegacySyncTarget
} from '../../dataSyncDefaults'
import { useArchiveImportExport } from '../../../hooks/useArchiveImportExport'
import { applyArchiveImportFeedback } from '../../../utils/archive-restore-feedback'
import {
  buildArchiveImportProgress,
  reportArchiveImportStage,
  type ArchiveImportProgress
} from '../../../services/archive-guards.util'

export function useDataSyncCloud() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, notifyArchiveRestoreComplete } = useBaishou()

  const [syncConfig, setSyncConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG)
  const [configDraft, setConfigDraft] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG)
  const [configLoaded, setConfigLoaded] = useState(false)

  const [cloudRecords, setCloudRecords] = useState<SyncRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsRefreshing, setRecordsRefreshing] = useState(false)
  const [recordsFetchError, setRecordsFetchError] = useState<string | null>(null)
  const toastRef = useRef(toast)
  const tRef = useRef(t)
  const fetchInFlightRef = useRef(false)
  const lastFetchedConfigKeyRef = useRef<string | null>(null)
  const recordsFetchErrorRef = useRef<string | null>(null)
  toastRef.current = toast
  tRef.current = t
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [cloudRestoreProgress, setCloudRestoreProgress] = useState<ArchiveImportProgress | null>(
    null
  )
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [renamingRecord, setRenamingRecord] = useState<string | null>(null)
  const [newRecordName, setNewRecordName] = useState('')
  const [backupTab, setBackupTab] = useState<'cloud' | 'snapshot' | 'local'>('cloud')
  const [showCountModal, setShowCountModal] = useState(false)
  const [tempCount, setTempCount] = useState(20)
  const [showConfigForm, setShowConfigForm] = useState(false)
  const [showPasswordInConfig, setShowPasswordInConfig] = useState(false)

  const noLimitLabel = t('data_sync.no_limit', '不限制数量')
  const cloudSyncService = services?.cloudSyncService
  const {
    handleExport: handleArchiveExport,
    handleImport: handleArchiveImport,
    isImporting: isArchiveImporting,
    importMessage: archiveImportMessage,
    importHint: archiveImportHint,
    importDetail: archiveImportDetail,
    importPercent: archiveImportPercent,
    importSucceeded: archiveImportSucceeded
  } = useArchiveImportExport()

  const totalSizeString = useMemo(() => {
    const total = cloudRecords.reduce((sum, r) => sum + r.sizeInBytes, 0)
    if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`
    return `${(total / (1024 * 1024)).toFixed(2)} MB`
  }, [cloudRecords])

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

  const syncConfigKey = useMemo(() => getCloudSyncFetchKey(syncConfig), [syncConfig])

  const fetchCloudRecords = useCallback(
    async (options?: { force?: boolean }) => {
      if (!cloudSyncService || syncConfig.target === 'local') {
        setCloudRecords([])
        setRecordsFetchError(null)
        recordsFetchErrorRef.current = null
        lastFetchedConfigKeyRef.current = null
        return
      }
      if (!isRemoteCloudSyncConfigured(syncConfig)) {
        setCloudRecords([])
        setRecordsFetchError(null)
        recordsFetchErrorRef.current = null
        lastFetchedConfigKeyRef.current = null
        return
      }
      if (fetchInFlightRef.current) return
      if (
        !options?.force &&
        lastFetchedConfigKeyRef.current === syncConfigKey &&
        recordsFetchErrorRef.current
      ) {
        return
      }

      fetchInFlightRef.current = true
      setRecordsLoading(true)
      try {
        const records = await cloudSyncService.listRecords(syncConfig)
        setCloudRecords(records)
        setRecordsFetchError(null)
        recordsFetchErrorRef.current = null
        lastFetchedConfigKeyRef.current = syncConfigKey
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setCloudRecords([])
        lastFetchedConfigKeyRef.current = syncConfigKey

        if (msg.includes('403') && syncConfig.target !== 'webdav') {
          logger.warn('加载云端记录失败（S3 权限或密钥错误）', msg)
          const errorText = i18n.t(
            'data_sync.s3_list_forbidden',
            'S3 列表失败：请检查 Access Key、Secret 与桶策略（需 s3:ListBucket / 列举前缀对象权限）'
          )
          recordsFetchErrorRef.current = errorText
          setRecordsFetchError(errorText)
          if (options?.force) {
            toastRef.current.showError(errorText)
          }
        } else {
          logger.error('加载云端记录失败', e instanceof Error ? e : String(e))
          const errorText =
            msg || tRef.current('data_sync.load_records_failed', '加载云端记录失败')
          recordsFetchErrorRef.current = errorText
          setRecordsFetchError(errorText)
          if (options?.force) {
            toastRef.current.showError(errorText)
          }
        }
      } finally {
        fetchInFlightRef.current = false
        setRecordsLoading(false)
        setIsMultiSelectMode(false)
        setSelectedRecords(new Set())
      }
    },
    [cloudSyncService, syncConfig, syncConfigKey]
  )

  useEffect(() => {
    if (!configLoaded || backupTab !== 'cloud') return
    if (lastFetchedConfigKeyRef.current === syncConfigKey) return
    void fetchCloudRecords()
    // 仅随配置指纹变化自动拉取；fetchCloudRecords 通过闭包读取最新状态，避免 toast 等依赖引发重试循环
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configLoaded, backupTab, syncConfigKey])

  const handleRefreshRecords = useCallback(async () => {
    setRecordsRefreshing(true)
    await fetchCloudRecords({ force: true })
    setRecordsRefreshing(false)
  }, [fetchCloudRecords])

  const showHelp = () => {
    const message =
      backupTab === 'snapshot'
        ? t('data_sync.snapshot_tooltip')
        : backupTab === 'local'
          ? t('settings.local_archive_backup_desc')
          : t('data_sync.backup_tooltip')
    const title =
      backupTab === 'snapshot'
        ? t('data_sync.local_snapshots_tab')
        : backupTab === 'local'
          ? t('data_sync.local_backup_tab', '本地备份')
          : t('data_sync.sync_records', '云端备份')
    void dialog.alert(message, title)
  }

  const openCountModal = () => {
    if (backupTab === 'snapshot') {
      setTempCount(syncConfig.maxSnapshotCount ?? 5)
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
    lastFetchedConfigKeyRef.current = null
    recordsFetchErrorRef.current = null
    setRecordsFetchError(null)
    await fetchCloudRecords({ force: true })
  }

  const handleRestoreRecord = useCallback(
    async (filename: string) => {
      const confirmed = await dialog.confirm(t('data_sync.cloud_restore_warning'), {
        title: t('data_sync.confirm_cloud_restore'),
        confirmText: t('common.confirm')
      })
      if (!confirmed || !cloudSyncService) return
      setIsRestoring(true)
      setCloudRestoreProgress(buildArchiveImportProgress('preparing'))
      try {
        const result = await cloudSyncService.restoreFromCloud(syncConfig, filename, (progress) =>
          setCloudRestoreProgress(progress)
        )
        if (result.success) {
          reportArchiveImportStage(setCloudRestoreProgress, 'succeeded', { percent: 100 })
          applyArchiveImportFeedback(
            {
              fileCount: -1,
              profileRestored: true
            },
            t,
            toast,
            notifyArchiveRestoreComplete,
            { successMessage: result.message }
          )
          await new Promise((resolve) => setTimeout(resolve, 900))
        } else {
          setCloudRestoreProgress(
            buildArchiveImportProgress('failed', { percent: 100, detail: result.message })
          )
          toast.showError(result.message)
          await new Promise((resolve) => setTimeout(resolve, 900))
        }
      } catch (e) {
        logger.error('云端恢复失败', e instanceof Error ? e : String(e))
        const message = e instanceof Error ? e.message : String(e)
        setCloudRestoreProgress(
          buildArchiveImportProgress('failed', { percent: 100, detail: message })
        )
        toast.showError(t('data_sync.restore_failed'))
        await new Promise((resolve) => setTimeout(resolve, 900))
      } finally {
        setIsRestoring(false)
        setCloudRestoreProgress(null)
      }
    },
    [cloudSyncService, dialog, notifyArchiveRestoreComplete, syncConfig, t, toast]
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
        await fetchCloudRecords({ force: true })
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
  return {
    t,
    toast,
    dialog,
    services,
    dbReady,
    notifyArchiveRestoreComplete,
    syncConfig,
    setSyncConfig,
    configDraft,
    setConfigDraft,
    showConfigForm,
    setShowConfigForm,
    showPasswordInConfig,
    setShowPasswordInConfig,
    cloudRecords,
    recordsLoading,
    recordsRefreshing,
    recordsFetchError,
    isSyncing,
    isRestoring,
    cloudRestoreProgress,
    isMultiSelectMode,
    setIsMultiSelectMode,
    selectedRecords,
    setSelectedRecords,
    renamingRecord,
    setRenamingRecord,
    newRecordName,
    setNewRecordName,
    backupTab,
    setBackupTab,
    showCountModal,
    setShowCountModal,
    tempCount,
    setTempCount,
    noLimitLabel,
    totalSizeString,
    fetchCloudRecords,
    handleRefreshRecords,
    showHelp,
    openCountModal,
    confirmCountModal,
    openSettings,
    handleSaveConfig,
    handleRestoreRecord,
    handleDeleteCloudRecord,
    handleBatchDeleteRecords,
    handleRenameRecord,
    toggleRecordSelection,
    handleSyncNow,
    maxCountLabel,
    handleArchiveExport,
    handleArchiveImport,
    isArchiveImporting,
    archiveImportMessage,
    archiveImportHint,
    archiveImportDetail,
    archiveImportPercent,
    archiveImportSucceeded
  }
}
