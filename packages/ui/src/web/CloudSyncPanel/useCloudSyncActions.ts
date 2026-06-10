import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import { useDialog } from '../Dialog'
import type { CloudSyncPanelProps, SyncConfig } from './cloud-sync.types'
import { DEFAULT_SYNC_CONFIG } from './cloud-sync.constants'

export interface UseCloudSyncActionsParams {
  props: CloudSyncPanelProps
  config: SyncConfig
  setConfig: React.Dispatch<React.SetStateAction<SyncConfig>>
  activeTab: 'cloud' | 'snapshot'
  selected: Set<string>
  setIsSyncing: React.Dispatch<React.SetStateAction<boolean>>
  setIsRestoring: React.Dispatch<React.SetStateAction<boolean>>
  setShowConfig: React.Dispatch<React.SetStateAction<boolean>>
  tempCount: number
  setTempCount: React.Dispatch<React.SetStateAction<number>>
  setShowCountModal: React.Dispatch<React.SetStateAction<boolean>>
  fetchRecords: () => Promise<void>
  onSaveConfig?: (config: SyncConfig) => void
}

export function useCloudSyncActions({
  props,
  config,
  setConfig,
  activeTab,
  selected,
  setIsSyncing,
  setIsRestoring,
  setShowConfig,
  tempCount,
  setTempCount,
  setShowCountModal,
  fetchRecords,
  onSaveConfig
}: UseCloudSyncActionsParams) {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()

  const {
    onSyncNow,
    onRestore,
    onDownloadBackup,
    onDeleteRecord,
    onBatchDelete,
    onRename,
    savedConfig,
    onRestoreSnapshot,
    onDeleteSnapshot,
    onBatchDeleteSnapshots,
    onRenameSnapshot
  } = props

  const updateField = (key: keyof SyncConfig, value: unknown) => {
    const next = { ...config, [key]: value }
    setConfig(next)
    onSaveConfig?.(next)
  }

  const handleSaveConfig = () => {
    onSaveConfig?.(config)
    setShowConfig(false)
    fetchRecords()
  }

  const handleSync = async () => {
    if (config.target === 'local') {
      toast.show(t('cloud.sync_target_local_hint', '当前同步目标为本地，请先配置云端'))
      return
    }
    setIsSyncing(true)
    try {
      const res = await onSyncNow(config)
      if (res.success) toast.showSuccess(res.message)
      else toast.showError(res.message)
      if (res.success) await fetchRecords()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleRestore = async (filename: string) => {
    const confirmed = await dialog.confirm(
      activeTab === 'snapshot'
        ? t(
            'sync.restore_snapshot_confirm_msg',
            'Restore from local snapshot "{{filename}}"?\nYour current local data will be overwritten.',
            { filename }
          )
        : t(
            'sync.restore_confirm_msg',
            'Restore backup "{{filename}}"?\nYour current local data will be overwritten.',
            { filename }
          )
    )
    if (!confirmed) return
    setIsRestoring(true)
    let willReload = false
    try {
      const res =
        activeTab === 'snapshot'
          ? onRestoreSnapshot
            ? await onRestoreSnapshot(filename)
            : {
                success: false,
                message: t(
                  'sync.snapshot_restore_not_implemented',
                  'Snapshot restore is not available'
                )
              }
          : await onRestore(config, filename)
      if (res.success) toast.showSuccess(res.message)
      else toast.showError(res.message)
      if (res.success) {
        willReload = true
        setTimeout(() => window.location.reload(), 1500)
      }
    } finally {
      if (!willReload) setIsRestoring(false)
    }
  }

  const handleDownload = async (filename: string) => {
    if (!onDownloadBackup) return
    setIsSyncing(true)
    try {
      const res = await onDownloadBackup(config, filename)
      if (res.success) toast.showSuccess(res.message)
      else toast.showError(res.message)
    } catch (e: any) {
      toast.showError(t('cloud.download_failed', '下载失败: ') + (e.message || e))
    } finally {
      setIsSyncing(false)
    }
  }

  const handleDelete = async (filename: string) => {
    const confirmed =
      activeTab === 'snapshot'
        ? await dialog.confirm(
            t('sync.delete_snapshot_confirm', 'Permanently delete local snapshot "{{filename}}"?', {
              filename
            })
          )
        : await dialog.confirm(
            t('sync.delete_confirm', 'Permanently delete cloud backup "{{filename}}"?', {
              filename
            })
          )
    if (!confirmed) return
    try {
      if (activeTab === 'snapshot') {
        if (onDeleteSnapshot) await onDeleteSnapshot(filename)
      } else {
        await onDeleteRecord(config, filename)
      }
      await fetchRecords()
      toast.showSuccess(t('cloud.delete_success', '删除成功'))
    } catch (e: any) {
      toast.showError(t('cloud.delete_failed', '删除失败: ') + e.message)
    }
  }

  const handleBatchDelete = async () => {
    if (selected.size === 0) return
    const confirmed =
      activeTab === 'snapshot'
        ? await dialog.confirm(
            t(
              'sync.bulk_delete_snapshot_confirm',
              'Permanently delete {{count}} selected local snapshot(s)? This cannot be undone.',
              { count: selected.size }
            )
          )
        : await dialog.confirm(
            t(
              'sync.bulk_delete_confirm',
              'Permanently delete {{count}} selected backup(s)? This cannot be undone.',
              { count: selected.size }
            )
          )
    if (!confirmed) return
    try {
      if (activeTab === 'snapshot') {
        if (onBatchDeleteSnapshots) await onBatchDeleteSnapshots(Array.from(selected))
      } else {
        await onBatchDelete(config, Array.from(selected))
      }
      await fetchRecords()
      toast.showSuccess(t('cloud.batch_delete_success', '批量删除成功'))
    } catch (e: any) {
      toast.showError(t('cloud.batch_delete_failed', '批量删除失败: ') + e.message)
    }
  }

  const handleRename = async (oldName: string) => {
    const newName = await dialog.prompt(t('cloud.rename', '重命名'), oldName)
    if (!newName || newName === oldName) return
    try {
      if (activeTab === 'snapshot') {
        if (onRenameSnapshot) await onRenameSnapshot(oldName, newName)
      } else {
        await onRename(config, oldName, newName)
      }
      await fetchRecords()
      toast.showSuccess(t('cloud.rename_success', '重命名成功'))
    } catch (e: any) {
      toast.showError(t('cloud.rename_failed', '重命名失败: ') + e.message)
    }
  }

  const openSettings = () => {
    setConfig({ ...DEFAULT_SYNC_CONFIG, ...(savedConfig || {}) })
    setShowConfig(true)
  }

  const openCountModal = () => {
    if (activeTab === 'snapshot') {
      setTempCount(config.maxSnapshotCount === -1 ? 5 : config.maxSnapshotCount!)
    } else {
      setTempCount(config.maxBackupCount === -1 ? 20 : config.maxBackupCount)
    }
    setShowCountModal(true)
  }

  const confirmCountModal = () => {
    const targetField = activeTab === 'snapshot' ? 'maxSnapshotCount' : 'maxBackupCount'
    updateField(targetField, tempCount)
    onSaveConfig?.({ ...config, [targetField]: tempCount })
    setShowCountModal(false)
  }

  return {
    updateField,
    handleSaveConfig,
    handleSync,
    handleRestore,
    handleDownload,
    handleDelete,
    handleBatchDelete,
    handleRename,
    openSettings,
    openCountModal,
    confirmCountModal
  }
}
