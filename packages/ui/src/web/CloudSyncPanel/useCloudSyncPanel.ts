import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CloudSyncPanelProps, DataSyncTab } from './cloud-sync.types'
import { DEFAULT_SYNC_CONFIG } from './cloud-sync.constants'
import { getTargetColor, getTargetIcon } from './cloud-sync.helpers'
import { useCloudSyncFetch } from './useCloudSyncFetch'
import { useCloudSyncActions } from './useCloudSyncActions'

export function useCloudSyncPanel(props: CloudSyncPanelProps) {
  const { t } = useTranslation()
  const noLimitLabel = t('data_sync.no_limit', 'No Limit')
  const { savedConfig, onSaveConfig, onListRecords, onListSnapshots, onDownloadBackup } = props
  const { onExportZip, onImportZip, onPickArchiveFile } = props

  const [config, setConfig] = useState(() => ({
    ...DEFAULT_SYNC_CONFIG,
    ...(savedConfig || {})
  }))
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [showCountModal, setShowCountModal] = useState(false)
  const [tempCount, setTempCount] = useState(config.maxBackupCount)
  const [activeTab, setActiveTab] = useState<DataSyncTab>('cloud')
  const [showPassword, setShowPassword] = useState(false)

  const fetchState = useCloudSyncFetch(
    config,
    setConfig,
    activeTab,
    onListRecords,
    onListSnapshots,
    savedConfig
  )

  const actions = useCloudSyncActions({
    props,
    config,
    setConfig,
    activeTab,
    selected: fetchState.selected,
    setIsSyncing,
    setIsRestoring,
    setShowConfig,
    tempCount,
    setTempCount,
    setShowCountModal,
    fetchRecords: fetchState.fetchRecords,
    onSaveConfig
  })

  const totalSizeMb = fetchState.records.reduce((sum, r) => sum + r.sizeInBytes, 0) / (1024 * 1024)
  const sizeString = totalSizeMb > 0 ? totalSizeMb.toFixed(2) + ' MB' : '0 MB'

  return {
    t,
    noLimitLabel,
    config,
    setConfig,
    ...fetchState,
    isSyncing,
    isRestoring,
    showConfig,
    setShowConfig,
    showCountModal,
    setShowCountModal,
    tempCount,
    setTempCount,
    activeTab,
    setActiveTab,
    showPassword,
    setShowPassword,
    sizeString,
    getTargetIcon,
    getTargetColor,
    onDownloadBackup,
    onExportZip,
    onImportZip,
    onPickArchiveFile,
    onSaveConfig,
    savedConfig,
    ...actions
  }
}

export type CloudSyncPanelViewModel = ReturnType<typeof useCloudSyncPanel>
