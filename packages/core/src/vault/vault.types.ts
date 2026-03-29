export interface VaultInfo {
  name: string;
  path: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface IVaultService {
  /**
   * 初始化注册表，如果不存在则默认创建 "Personal" 空间
   * 同时负责将 registry 的绝对路径从旧设备跨端修正到当前设备
   */
  initRegistry(): Promise<void>;

  /** 获取最后访问的有效 Vault */
  getActiveVault(): VaultInfo | null;

  /** 获取所有注册的 Vault 列表 */
  getAllVaults(): VaultInfo[];

  /**
   * 切换或创建空间库
   * 如果存在则更新 lastAccessedAt，不存在则在磁盘建立物理目录并存入注册表
   */
  switchVault(vaultName: string): Promise<void>;

  /**
   * 安全删除指定工作区（防呆：不可删除当前正在活动的工作区）
   * @throws {VaultActiveDeleteError} 不能删除当前工作区
   * @throws {VaultNotFoundError}
   */
  deleteVault(vaultName: string): Promise<void>;
}
