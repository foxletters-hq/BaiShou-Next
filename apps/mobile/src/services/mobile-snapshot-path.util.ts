export const MOBILE_SNAPSHOTS_DIR_NAME = 'snapshots'

/** 快照存放在工作区根目录下，避免大文件占满应用沙盒 */
export function resolveMobileSnapshotsDirectory(workspaceRoot: string): string {
  let base = workspaceRoot.trim()
  while (base.startsWith('file://')) {
    base = base.slice('file://'.length)
  }
  return `${base.replace(/\/+$/, '')}/${MOBILE_SNAPSHOTS_DIR_NAME}`
}

/** 旧版曾将快照放在应用 Document 沙盒，升级后需迁移到工作区 */
export function resolveLegacySandboxSnapshotsDirectory(appDocumentDir: string): string {
  let base = appDocumentDir.trim()
  while (base.startsWith('file://')) {
    base = base.slice('file://'.length)
  }
  return `${base.replace(/\/+$/, '')}/${MOBILE_SNAPSHOTS_DIR_NAME}`
}
