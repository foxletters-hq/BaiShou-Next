import React from 'react'
import { CloudSyncPanel } from '@baishou/ui'
import { cloudSyncArchiveApi } from '../cloudSyncArchiveApi'

interface DataSyncPaneProps {
  settings: any
}

export const DataSyncPane: React.FC<DataSyncPaneProps> = ({ settings }) => {
  return (
    <div className="settings-pane settings-pane-full">
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
      />
    </div>
  )
}
