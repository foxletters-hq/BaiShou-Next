/** 数据备份页共用的本地快照 IPC 封装 */
export const cloudSyncArchiveApi = {
  listSnapshots: async () => {
    const list = await (window as any).api?.archive?.listSnapshots()
    return (list || []).map((s: { filename: string; createdAt: number; size: number }) => ({
      filename: s.filename,
      lastModified: new Date(s.createdAt).toISOString(),
      sizeInBytes: s.size,
      managed: true
    }))
  },
  restoreSnapshot: async (filename: string) => {
    try {
      const res = await (window as any).api?.archive?.restoreSnapshot(filename)
      if (res.profileRestored) {
        return { success: true, message: '快照还原成功，准备重启' }
      }
      return { success: false, message: '还原未成功完成' }
    } catch (e: any) {
      return { success: false, message: e.message || '还原失败' }
    }
  },
  deleteSnapshot: async (filename: string) => {
    await (window as any).api?.archive?.deleteSnapshot(filename)
    return true
  },
  batchDeleteSnapshots: async (filenames: string[]) => {
    return await (window as any).api?.archive?.batchDeleteSnapshots(filenames)
  },
  renameSnapshot: async (oldName: string, newName: string) => {
    await (window as any).api?.archive?.renameSnapshot(oldName, newName)
    return true
  }
}
