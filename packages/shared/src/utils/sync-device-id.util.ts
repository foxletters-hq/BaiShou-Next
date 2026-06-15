import { SYNC_DEVICE_ID_FILENAME } from '../constants/incremental-sync.constants'

export interface SyncDeviceIdStorage {
  exists(path: string): Promise<boolean> | boolean
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  mkdir(path: string): Promise<void>
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 每台设备安装级稳定 deviceId，写入同步根 `.baishou/sync-device-id.txt`。
 * 仅用于 manifest 元数据与日志，不参与合并决策。
 */
export async function resolveSyncDeviceId(
  platform: 'desktop' | 'mobile',
  syncMetaDir: string,
  storage: SyncDeviceIdStorage
): Promise<string> {
  const idPath = `${syncMetaDir.replace(/\/$/, '')}/${SYNC_DEVICE_ID_FILENAME}`
  const exists = await storage.exists(idPath)
  if (exists) {
    try {
      const saved = (await storage.read(idPath)).trim()
      if (saved) return saved
    } catch {
      // regenerate below
    }
  }

  const id = `${platform}-${Date.now().toString(36)}-${randomSuffix()}`
  await storage.mkdir(syncMetaDir)
  await storage.write(idPath, id)
  return id
}
