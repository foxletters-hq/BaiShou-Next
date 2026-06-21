export interface AttachmentFileItem {
  name: string
  path: string
  sizeMB: number
  birthtime: string
}

export interface SessionAttachmentGroup {
  sessionId: string
  sessionTitle?: string
  isOrphan: boolean
  totalSizeMB: number
  fileCount: number
  files: AttachmentFileItem[]
}

export interface AttachmentItem {
  id: string // Session ID for attachments folder, or the name of the folder if orphan
  name: string
  sizeMB: number
  isOrphan: boolean
  fileCount: number
  date: string
}

export interface DiaryAttachmentFileItem {
  name: string
  path: string // 绝对物理路径 (用于打开位置/删除)
  relativePath: string // 相对 Journals 目录的路径 (如: 2026/05/attachment/pasted_123.png)
  sizeMB: number
  birthtime: string
  yearMonth: string // 格式: YYYY-MM
  isOrphan: boolean // 是否是孤立附件 (在同年月的所有日记中都没有被引用)
}

export interface IAttachmentManager {
  /**
   * Imports an avatar into the local Vault Avatar pool.
   * @param absoluteSourcePath The physical path picked by the user.
   * @param prefix Optional prefix for the resulting avatar name (e.g. 'agent', 'user').
   * @returns The relative path representing the imported avatar (e.g., 'avatars/agent_123.jpg').
   *          If the source doesn't exist or fails, it should return the original input or null.
   */
  importAvatar(
    absoluteSourcePath: string,
    prefix?: string,
    /** 已知原图字节数时可跳过为测大小重复读取 content://（移动端 ImagePicker fileSize） */
    sourceByteSize?: number
  ): Promise<string>

  /**
   * Converts a Vault-relative avatar path back into an absolute URI for native desktop rendering.
   * @param relativePath The path saved in DB (e.g. 'avatars/agent_123.jpg')
   * @returns Absolute path safely resolvable by the viewer
   */
  resolveAvatarPath(relativePath: string): Promise<string>

  /**
   * Scans the Vault Attachments directory and checks for folder names against active session criteria.
   * @param activeSessionIds A Set of active valid UUIDs tracking valid Agent Sessions natively
   * @returns A list of calculated attachment folders
   */
  listOrphans(activeSessionIds: Set<string>): Promise<AttachmentItem[]>

  /**
   * Scans the Vault Attachments directory and groups files by session.
   * @param activeSessionIds A Set of active valid UUIDs tracking valid Agent Sessions natively
   * @returns A list of session attachment groups with nested file items
   */
  listSessionGroups(activeSessionIds: Set<string>): Promise<SessionAttachmentGroup[]>

  /**
   * Deletes a specific file inside a session attachment directory.
   * @param sessionId The UUID folder name
   * @param fileName The specific file name to delete
   */
  deleteFile(sessionId: string, fileName: string): Promise<void>

  /**
   * Bulk deletion sweep for given folder UUIDs representing Session attachments
   * @param ids The UUID folder names to nuke natively
   */
  deleteBatch(ids: string[]): Promise<void>

  /**
   * 扫描日记所有的附件文件，并进行孤立状态的脏检查
   */
  listDiaryAttachments(): Promise<DiaryAttachmentFileItem[]>

  /**
   * 物理删除指定的日记附件文件，并清理可能产生空子文件夹
   * @param filePath 绝对路径
   */
  deleteDiaryAttachment(filePath: string): Promise<void>

  /**
   * Imports a chat background image into the Vault backgrounds pool.
   * @param absoluteSourcePath The physical path picked by the user.
   * @returns The relative path representing the imported background (e.g., 'backgrounds/bg_123.jpg').
   */
  importBackground(absoluteSourcePath: string): Promise<string>

  /**
   * Converts a Vault-relative background path back into an absolute URI for native desktop rendering.
   * @param relativePath The path saved in DB (e.g. 'backgrounds/bg_123.jpg')
   * @returns Absolute path safely resolvable by the viewer
   */
  resolveBackgroundPath(relativePath: string): Promise<string>
}
