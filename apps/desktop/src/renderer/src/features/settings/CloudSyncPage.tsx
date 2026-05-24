import React, { useEffect } from 'react'
import { CloudSyncPanel } from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'

export const CloudSyncPage: React.FC = () => {
  const settings = useSettingsStore()

  useEffect(() => {
    settings.loadConfig()
  }, [settings.loadConfig])

  return (
    <div style={{ flex: 1, padding: 0, overflowY: 'auto' }}>
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
        onListSnapshots={async () => {
          const list = await (window as any).api?.archive?.listSnapshots()
          return (list || []).map((s: any) => ({
            filename: s.filename,
            lastModified: new Date(s.createdAt).toISOString(),
            sizeInBytes: s.size,
            managed: true
          }))
        }}
        onRestoreSnapshot={async (filename: string) => {
          try {
            const res = await (window as any).api?.archive?.restoreSnapshot(filename)
            if (res.profileRestored) {
              return { success: true, message: '快照还原成功，准备重启' }
            }
            return { success: false, message: '还原未成功完成' }
          } catch (e: any) {
            return { success: false, message: e.message || '还原失败' }
          }
        }}
        onDeleteSnapshot={async (filename: string) => {
          await (window as any).api?.archive?.deleteSnapshot(filename)
          return true
        }}
        onBatchDeleteSnapshots={async (filenames: string[]) => {
          return await (window as any).api?.archive?.batchDeleteSnapshots(filenames)
        }}
        onRenameSnapshot={async (oldName: string, newName: string) => {
          await (window as any).api?.archive?.renameSnapshot(oldName, newName)
          return true
        }}
      />
    </div>
  )
}
