export interface VaultInfo {
  /** 稳定身份（vlt_…）；与显示名 / 目录名解耦 */
  id: string
  name: string
  path: string
  createdAt: Date
  lastAccessedAt: Date
}

/** 仓内身份元数据：`<vault>/.baishou/vault.json`（不写 path） */
export interface VaultIdentityMeta {
  id: string
  displayName: string
  createdAt: string
}

export const VAULT_IDENTITY_META_FILENAME = 'vault.json' as const

export interface IVaultService {
  /**
   * 初始化注册表，如果不存在则默认创建 "Personal" 空间
   * 同时负责将 registry 的绝对路径从旧设备跨端修正到当前设备
   */
  initRegistry(): Promise<void>

  /** 获取最后访问的有效 Vault */
  getActiveVault(): VaultInfo | null

  /**
   * 活跃仓库 { id, name }；无活跃仓库时返回 null。
   * 调用方写库/检索应使用 id，展示用 name。
   */
  resolveActiveVault(): Pick<VaultInfo, 'id' | 'name'> | null

  /** 获取所有注册的 Vault 列表 */
  getAllVaults(): VaultInfo[]

  /** 名称是否已在注册表中（大小写 / 目录名冲突也算存在） */
  vaultExists(vaultName: string): boolean

  /**
   * 检测注册表内已有的大小写或消毒目录冲突（存量诊断）
   */
  findRegistryNameConflicts(): Array<{
    left: string
    right: string
    kind: 'case' | 'directory'
  }>

  /**
   * 创建新工作空间（名称已存在或非法时抛错，不会切换至已有空间）
   * @throws {VaultNameExistsError}
   * @throws {VaultInvalidNameError}
   */
  createVault(vaultName: string): Promise<void>

  /**
   * 切换或创建空间库
   * 如果存在则更新 lastAccessedAt，不存在则在磁盘建立物理目录并存入注册表
   */
  switchVault(vaultName: string): Promise<void>

  /**
   * 安全删除指定工作区（防呆：不可删除当前正在活动的工作区）
   * @throws {VaultActiveDeleteError} 不能删除当前工作区
   * @throws {VaultNotFoundError}
   */
  deleteVault(vaultName: string): Promise<void>

  /**
   * 扫描存储根下全部工作区目录，补登记未注册项（不切换当前活动工作区）
   */
  syncRegistryWithDisk(): Promise<string[]>

  /**
   * 将给定名称补登记进注册表；目录不存在时会创建骨架（用于远端即将下载的工作区）
   */
  ensureVaultsRegistered(vaultNames: Iterable<string>): Promise<string[]>

  /**
   * 移除本机无目录、且本地/远端 manifest 均无文件的空注册项（跨端遗留工作区名）
   */
  pruneOrphanRegistryVaults(
    manifestVaultScopes: ReadonlySet<string>,
    diskVaultNames: readonly string[]
  ): Promise<string[]>
}
