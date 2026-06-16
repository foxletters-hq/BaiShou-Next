export interface InstallInstanceIdStorage {
  exists(path: string): Promise<boolean> | boolean
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  mkdir(path: string): Promise<void>
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10)
}

/**
 * 应用安装实例 ID（存于应用私有目录，不随 BaiShou_Root 卸载保留）。
 * 用于区分外部存储上遗留的 migration status 与当前安装。
 */
export async function resolveInstallInstanceId(
  platform: 'desktop' | 'mobile',
  storageDir: string,
  storage: InstallInstanceIdStorage
): Promise<string> {
  const idPath = `${storageDir.replace(/\/$/, '')}/install_instance_id`
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
  await storage.mkdir(storageDir)
  await storage.write(idPath, id)
  return id
}
