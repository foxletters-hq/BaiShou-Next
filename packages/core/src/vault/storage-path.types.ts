export interface IStoragePathService {
  /**
   * 获取全局注册表的路径
   */
  getGlobalRegistryDirectory(): Promise<string>;

  /**
   * 获取某个特定 Vault 的根物理目录
   */
  getVaultDirectory(vaultName: string): Promise<string>;

  /**
   * 获取 Vault 内的 .baishou 系统目录
   */
  getVaultSystemDirectory(vaultName: string): Promise<string>;

  /**
   * 获取应用全局存放所有 Vaults 的根目录
   */
  getRootDirectory(): Promise<string>;

  /**
   * 获取用于全局归档备份系统使用的快照缓存目录
   */
  getSnapshotsDirectory(): Promise<string>;

  /**
   * 返回当前活动 Vault 下用于写入 Markdown 日记的位置
   */
  getJournalsBaseDirectory(): Promise<string>;

  /**
   * 返回当前活动 Vault 下用于定格各类总结回顾的 Markdown 文件夹位置
   */
  getSummariesBaseDirectory(): Promise<string>;

  /**
   * 返回当前活动 Vault 下用于存放 AI Agent 长记忆 JSON 存储的位置
   */
  getSessionsBaseDirectory(): Promise<string>;

  /**
   * 返回当前活动 Vault 下用于存放用户设置的 AI 模型助手角色位置
   */
  getAssistantsBaseDirectory(): Promise<string>;

  /**
   * 返回当前活动 Vault 下附件与多媒体中心目录
   */
  getAttachmentsBaseDirectory(): Promise<string>;

  /**
   * 返回专门用于存放全局用户与伙伴头像的统一子目录
   */
  getAvatarsDirectory(): Promise<string>;
}
