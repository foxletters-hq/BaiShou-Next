import React, { useEffect } from 'react'
import { CloudSyncPanel } from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'
import { useTranslation } from 'react-i18next'
import { cloudSyncArchiveApi } from './cloudSyncArchiveApi'

export const CloudSyncPage: React.FC = () => {
  const settings = useSettingsStore()
  const { i18n } = useTranslation()
  const archiveLocale = settings.locale === 'system' ? i18n.language : settings.locale

  useEffect(() => {
    settings.loadConfig()
  }, [settings.loadConfig])

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <CloudSyncPanel
        savedConfig={settings.cloudSyncConfig}
        onSaveConfig={settings.setCloudSyncConfig}
        onSyncNow={async (config: any) => (window as any).api?.cloud?.syncNow(config)}
        onListRecords={async (config: any) => (window as any).api?.cloud?.listRecords(config)}
        onRestore={async (config: any, filename: string) =>
          (window as any).api?.cloud?.restore(config, filename)
        }
        onDownloadBackup={async (config: any, filename: string) =>
          (window as any).api?.cloud?.downloadRecord(config, filename)
        }
        onDeleteRecord={async (config: any, filename: string) =>
          (window as any).api?.cloud?.deleteRecord(config, filename)
        }
        onBatchDelete={async (config: any, filenames: string[]) =>
          (window as any).api?.cloud?.batchDelete(config, filenames)
        }
        onRename={async (config: any, oldName: string, newName: string) =>
          (window as any).api?.cloud?.rename(config, oldName, newName)
        }
        onListSnapshots={cloudSyncArchiveApi.listSnapshots}
        onRestoreSnapshot={cloudSyncArchiveApi.restoreSnapshot}
        onDeleteSnapshot={cloudSyncArchiveApi.deleteSnapshot}
        onBatchDeleteSnapshots={cloudSyncArchiveApi.batchDeleteSnapshots}
        onRenameSnapshot={cloudSyncArchiveApi.renameSnapshot}
        onExportZip={async () =>
          (window as any).api?.archive?.exportZip(archiveLocale)
        }
        onImportZip={async (filePath: string) => {
          await (window as any).api?.archive?.importZip(filePath)
        }}
        onImportProgress={(callback) =>
          (window as any).api?.archive?.onArchiveImportProgress?.(
            (progress: { detail?: string }) => {
              if (progress.detail) callback(progress.detail)
            }
          ) ?? (() => {})
        }
        onPickArchiveFile={async () => {
          return await (window as any).api?.archive?.pickZip(archiveLocale)
        }}
      />
    </div>
  )
}
