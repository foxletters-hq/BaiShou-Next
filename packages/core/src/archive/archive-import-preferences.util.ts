/** 归档导入时合并 device_preferences，保留本地 cloud_sync_config（含显式 null） */
export function mergeArchivePrefsPreservingCloudSync(
  prefs: Record<string, unknown>,
  localCloudSyncConfig: unknown
): Record<string, unknown> {
  if (localCloudSyncConfig !== undefined) {
    return { ...prefs, cloud_sync_config: localCloudSyncConfig }
  }
  return prefs
}

/** 写入归档 prefs 时是否跳过备份包内的 cloud_sync_config */
export function shouldPreserveLocalCloudSyncOnImport(localCloudSyncConfig: unknown): boolean {
  return localCloudSyncConfig !== undefined
}
