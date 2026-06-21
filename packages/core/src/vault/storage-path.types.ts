export interface IStoragePathService {
  /**
   * 获取全局注册表的路径
   */
  getGlobalRegistryDirectory(): Promise<string>

  /**
   * 获取当前活跃 Vault 的物理路径
   */
  getActiveVaultPath(): Promise<string | null>

  /**
   * 获取某个特定 Vault 的根物理目录
   */
  getVaultDirectory(vaultName: string): Promise<string>

  /**
   * 获取 Vault 内的 .baishou 系统目录
   */
  getVaultSystemDirectory(vaultName: string): Promise<string>

  /**
   * 当前活跃 Vault 的 .baishou 目录（settings.json 等）
   */
  getActiveVaultSettingsDirectory(): Promise<string>

  /**
   * 获取全局 Shadow DB 目录（单库 shadow_index_v2.db，所有 Vault 共用）
   * Desktop：userData/shadow_index；Mobile：应用沙盒 .baishou_global/shadow_index
   */
  getGlobalShadowIndexDirectory(): Promise<string>

  /**
   * 获取应用全局存放所有 Vaults 的根目录
   */
  getRootDirectory(): Promise<string>

  /**
   * 获取用于全局归档备份系统使用的快照缓存目录
   */
  getSnapshotsDirectory(): Promise<string>

  /**
   * 返回当前活动 Vault 下用于写入 Markdown 日记的位置
   */
  getJournalsBaseDirectory(): Promise<string>

  /**
   * 返回当前活动 Vault 下用于定格各类总结回顾的 Markdown 文件夹位置
   */
  getSummariesBaseDirectory(): Promise<string>

  /**
   * 返回旧版白守的 Archives 目录路径（用于兼容迁移）
   * 路径结构: <root>/<VaultName>/Archives/
   * 如果目录不存在则返回 null
   */
  getLegacyArchivesDirectory(): Promise<string | null>

  /**
   * 返回当前活动 Vault 下用于存放 AI Agent 长记忆 JSON 存储的位置
   */
  getSessionsBaseDirectory(): Promise<string>

  /**
   * 返回当前活动 Vault 下用于存放用户设置的 AI 模型助手角色位置
   */
  getAssistantsBaseDirectory(): Promise<string>

  /**
   * 返回当前活动 Vault 下附件与多媒体中心目录
   */
  getAttachmentsBaseDirectory(): Promise<string>

  /**
   * 返回专门用于存放全局用户与伙伴头像的统一子目录
   */
  getAvatarsDirectory(): Promise<string>

  /**
   * 用户个人头像目录（全应用共用，不随工作空间切换）
   */
  getUserAvatarsDirectory(): Promise<string>

  /**
   * 聊天背景图目录：Vaults/Personal/Attachments/backgrounds
   */
  getChatBackgroundsDirectory(): Promise<string>

  /**
   * 获取日记附件目录
   * 路径结构: Vault/Journals/{year}/{month}/attachment/
   * @param date 日期对象，用于确定年月
   */
  getDiaryAttachmentDirectory(date: Date): Promise<string>

  /**
   * 获取日记附件目录（根据年月字符串）
   * @param yearMonth 格式: "2026-05"
   */
  getDiaryAttachmentDirectoryByYearMonth(yearMonth: string): Promise<string>
}
