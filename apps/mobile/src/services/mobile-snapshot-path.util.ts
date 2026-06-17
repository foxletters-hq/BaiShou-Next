/** 快照存放在应用沙盒，避免全量导入 wipe 工作区根目录时一并删除保护快照 */
export function resolveMobileSnapshotsDirectory(appDocumentDir: string): string {
  let base = appDocumentDir.trim()
  while (base.startsWith('file://')) {
    base = base.slice('file://'.length)
  }
  return `${base.replace(/\/+$/, '')}/snapshots`
}
