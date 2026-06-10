import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../Toast/useToast'
import type { CloudSyncPanelProps, SyncConfig, SyncRecord } from './cloud-sync.types'
import { DEFAULT_SYNC_CONFIG } from './cloud-sync.constants'
import { ensureMinLoadingDelay } from './cloud-sync.utils'

export function useCloudSyncFetch(
  config: SyncConfig,
  setConfig: React.Dispatch<React.SetStateAction<SyncConfig>>,
  activeTab: 'cloud' | 'snapshot',
  onListRecords: CloudSyncPanelProps['onListRecords'],
  onListSnapshots: CloudSyncPanelProps['onListSnapshots'],
  savedConfig: SyncConfig | undefined
) {
  const { t } = useTranslation()
  const toast = useToast()
  const [records, setRecords] = useState<SyncRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [manageMode, setManageMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const resetSelection = () => {
    setManageMode(false)
    setSelected(new Set())
  }

  const fetchRecords = useCallback(async () => {
    const startTime = Date.now()

    if (activeTab === 'snapshot') {
      if (!onListSnapshots) {
        setRecords([])
        resetSelection()
        return
      }
      setIsLoading(true)
      try {
        const r = await onListSnapshots()
        setRecords(r)
      } catch (e: any) {
        toast.showError(
          t('cloud.fetch_snapshot_list_failed', '获取本地快照列表失败: ') + (e.message || e)
        )
      } finally {
        await ensureMinLoadingDelay(startTime)
        setIsLoading(false)
        resetSelection()
      }
      return
    }

    if (config.target === 'local') {
      setRecords([])
      return
    }
    setIsLoading(true)
    try {
      const r = await onListRecords(config)
      setRecords(r)
    } catch (e: any) {
      toast.showError(t('cloud.fetch_backup_list_failed', '获取备份列表失败: ') + (e.message || e))
    } finally {
      await ensureMinLoadingDelay(startTime)
      setIsLoading(false)
      resetSelection()
    }
  }, [config, activeTab, onListRecords, onListSnapshots, toast, t])

  useEffect(() => {
    if (!savedConfig) return
    const next = { ...DEFAULT_SYNC_CONFIG, ...savedConfig }
    setConfig(next)
    const startTime = Date.now()

    if (activeTab === 'cloud') {
      if (next.target !== 'local') {
        setIsLoading(true)
        onListRecords(next)
          .then((r) => setRecords(r))
          .catch((e) =>
            toast.showError(
              t('cloud.fetch_backup_list_failed', '获取备份列表失败: ') + (e.message || e)
            )
          )
          .finally(async () => {
            await ensureMinLoadingDelay(startTime)
            setIsLoading(false)
            resetSelection()
          })
      } else {
        setRecords([])
      }
    } else if (onListSnapshots) {
      setIsLoading(true)
      onListSnapshots()
        .then((r) => setRecords(r))
        .catch((e) =>
          toast.showError(
            t('cloud.fetch_snapshot_list_failed', '获取本地快照列表失败: ') + (e.message || e)
          )
        )
        .finally(async () => {
          await ensureMinLoadingDelay(startTime)
          setIsLoading(false)
          resetSelection()
        })
    } else {
      setRecords([])
      resetSelection()
    }
  }, [savedConfig, activeTab, onListRecords, onListSnapshots, setConfig, toast, t])

  useEffect(() => {
    fetchRecords()
  }, [activeTab, fetchRecords])

  return {
    records,
    isLoading,
    manageMode,
    setManageMode,
    selected,
    setSelected,
    fetchRecords
  }
}
