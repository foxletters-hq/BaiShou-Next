/**
 * 判断路径是否位于 Android 外部共享存储（FUSE / sdcardfs）。
 * 外部共享存储上开启 SQLite WAL 依赖 `-shm` 的 mmap 共享内存，在多用户容器与部分 ROM 的 FUSE 层
 * 易触发 SIGBUS/SIGSEGV 原生闪退或长时间阻塞；因此对外部路径改用 TRUNCATE 模式规避 `-shm` mmap。
 */
export function isAndroidExternalSharedStoragePath(dbPath: string): boolean {
  const normalized = dbPath.replace(/^file:\/\//, '').replace(/\\/g, '/')
  return (
    normalized.startsWith('/storage/emulated/') ||
    normalized.startsWith('/sdcard/') ||
    normalized.startsWith('/mnt/sdcard/')
  )
}

export function resolveExpoKnowledgeJournalMode(dbPath: string): 'WAL' | 'TRUNCATE' {
  return isAndroidExternalSharedStoragePath(dbPath) ? 'TRUNCATE' : 'WAL'
}
