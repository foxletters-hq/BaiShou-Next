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
}
