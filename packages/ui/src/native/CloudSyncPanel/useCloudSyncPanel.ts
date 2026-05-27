import { useState } from 'react'
import type { CloudSyncConfig, CloudSyncPanelProps } from './cloud-sync-panel.types'

export function useCloudSyncPanel({
  config,
  onSaveConfig,
  onSyncNow
}: Pick<CloudSyncPanelProps, 'config' | 'onSaveConfig' | 'onSyncNow'>) {
  const [selectedTarget, setSelectedTarget] = useState(config.target || 'local')
  const [localConfig, setLocalConfig] = useState<CloudSyncConfig>(config)
  const [syncing, setSyncing] = useState(false)

  const updateField = (field: keyof CloudSyncConfig, value: string | number) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    onSaveConfig?.({ ...localConfig, target: selectedTarget })
  }

  const handleSync = async () => {
    if (!onSyncNow) return
    setSyncing(true)
    await onSyncNow()
    setSyncing(false)
  }

  return {
    selectedTarget,
    setSelectedTarget,
    localConfig,
    updateField,
    syncing,
    handleSave,
    handleSync
  }
}
