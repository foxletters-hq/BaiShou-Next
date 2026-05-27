import React from 'react'
import { StorageSettingsCard, DataManagementCard } from '@baishou/ui'
import { useTranslation } from 'react-i18next'

export const StoragePage: React.FC = () => {
  const { t, i18n } = useTranslation()

  return (
    <div
      className="glass-panel"
      style={{ margin: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
    >
      <h1>{t('storage.title', '物理硬盘隔离项')}</h1>
      <DataManagementCard
        onExportZip={async () => {
          if (typeof window !== 'undefined' && window.electron) {
            await window.electron.ipcRenderer.invoke('archive:export', i18n.language)
          }
        }}
        onPickFile={async () => {
          if (typeof window !== 'undefined' && window.electron) {
            return window.electron.ipcRenderer.invoke('archive:pick-zip', i18n.language)
          }
          return null
        }}
        onImportZip={async (zipPath: string) => {
          if (typeof window !== 'undefined' && window.electron) {
            await window.electron.ipcRenderer.invoke('archive:import', zipPath, true)
          }
        }}
      />
      <StorageSettingsCard
        onRefreshStats={async () => {
          if (typeof window !== 'undefined' && window.electron) {
            return window.electron.ipcRenderer.invoke('rag:get-stats')
          }
          return { dbSize: 0, vectorCount: 0, cacheSize: 0 }
        }}
      />
    </div>
  )
}
