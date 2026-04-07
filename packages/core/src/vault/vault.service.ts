import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IVaultService, VaultInfo } from './vault.types';
import { IStoragePathService } from './storage-path.types';
import { VaultActiveDeleteError, VaultNotFoundError } from './vault.errors';

/**
 * VaultService — Vault 注册表管理服务
 *
 * 架构调整（双库分离版本）：
 * - 去掉了 `IDatabaseConnectionManager` 依赖
 * - Agent DB 现在是全局共用库（不随 Vault 切换），在 desktop app 层一次性初始化
 * - Shadow Index DB（per-vault）的连接由 vault.ipc.ts 在 Vault 切换/初始化后
 *   调用 `shadowConnectionManager.connect(vaultSystemDir)` 来管理
 *
 * 此服务只负责 Vault 注册表（vault_registry.json）的 CRUD。
 */
export class VaultService implements IVaultService {
  private _vaults: VaultInfo[] = [];

  constructor(
    private readonly pathService: IStoragePathService,
  ) {}

  public async initRegistry(): Promise<void> {
    const globalDir = await this.pathService.getGlobalRegistryDirectory();
    const registryFile = path.join(globalDir, 'vault_registry.json');
    const rootDir = await this.pathService.getRootDirectory();

    let shouldSave = false;
    let content: string | null = null;

    try {
      content = await fs.readFile(registryFile, 'utf-8');
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }

    if (!content) {
      const defaultVaultName = 'Personal';
      const defaultVaultPath = await this.pathService.getVaultDirectory(defaultVaultName);

      this._vaults = [{
        name: defaultVaultName,
        path: defaultVaultPath,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      }];
      shouldSave = true;

    } else {
      try {
        const rawList = JSON.parse(content);
        this._vaults = rawList.map((item: any) => ({
          name: item.name,
          path: item.path,
          createdAt: new Date(item.createdAt),
          lastAccessedAt: new Date(item.lastAccessedAt),
        }));

        for (let i = 0; i < this._vaults.length; i++) {
          const vault = this._vaults[i];
          if (!vault) continue;
          const expectedPath = path.join(rootDir, vault.name);
          // 容错匹配：路径归一化后比对
          const normalize = (p: string) => path.resolve(p).replace(/\\/g, '/');
          if (normalize(vault.path) !== normalize(expectedPath)) {
            vault.path = expectedPath;
            shouldSave = true;
          }
        }
      } catch (e) {
        // Fallback to Personal if file corrupted
        const defaultVaultPath = await this.pathService.getVaultDirectory('Personal');
        this._vaults = [{
          name: 'Personal',
          path: defaultVaultPath,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
        }];
        shouldSave = true;
      }
    }

    if (shouldSave) {
      await this.saveRegistry(registryFile);
    }

    // 确保活跃 Vault 的物理目录存在
    const activeVault = this.getActiveVault();
    if (activeVault) {
      await fs.mkdir(activeVault.path, { recursive: true });
      try {
        await fs.mkdir(path.join(activeVault.path, 'config'), { recursive: true });
      } catch (e) {}
      // 注意：Shadow DB 连接由 vault.ipc.ts 在此调用后触发 shadowConnectionManager.connect()
    }
  }

  public getActiveVault(): VaultInfo | null {
    if (this._vaults.length === 0) return null;

    return [...this._vaults].sort(
      (a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime()
    )[0] || null;
  }

  public getAllVaults(): VaultInfo[] {
    return [...this._vaults];
  }

  public async switchVault(vaultName: string): Promise<void> {
    const existingIndex = this._vaults.findIndex(v => v.name === vaultName);
    const globalDir = await this.pathService.getGlobalRegistryDirectory();
    const registryFile = path.join(globalDir, 'vault_registry.json');

    if (existingIndex !== -1) {
      const existing = this._vaults[existingIndex];
      if (existing) {
        existing.lastAccessedAt = new Date();
      }
    } else {
      const newPath = await this.pathService.getVaultDirectory(vaultName);
      // 确保物理目录结构已创建
      await fs.mkdir(newPath, { recursive: true });
      await fs.mkdir(await this.pathService.getVaultSystemDirectory(vaultName), { recursive: true });

      const newVault: VaultInfo = {
        name: vaultName,
        path: newPath,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };
      this._vaults.push(newVault);
    }

    await this.saveRegistry(registryFile);
    // 注意：Shadow DB 连接由 vault.ipc.ts 在此调用后触发 shadowConnectionManager.connect()
  }

  public async deleteVault(vaultName: string): Promise<void> {
    const activeVault = this.getActiveVault();
    if (activeVault?.name === vaultName) {
      throw new VaultActiveDeleteError(vaultName);
    }

    const existingIndex = this._vaults.findIndex(v => v.name === vaultName);
    if (existingIndex === -1) {
      throw new VaultNotFoundError(vaultName);
    }

    const existing = this._vaults[existingIndex];
    if (!existing) {
      throw new VaultNotFoundError(vaultName);
    }
    const vaultPath = existing.path;
    this._vaults.splice(existingIndex, 1);

    if (this._vaults.length === 0) {
      const p = await this.pathService.getVaultDirectory('Personal');
      this._vaults.push({
        name: 'Personal',
        path: p,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      });
    }

    const globalDir = await this.pathService.getGlobalRegistryDirectory();
    const registryFile = path.join(globalDir, 'vault_registry.json');
    await this.saveRegistry(registryFile);

    try {
      await fs.rm(vaultPath, { recursive: true, force: true });
    } catch (e) {
      // 文件删除失败时忽略（UI 层处理）
    }
  }

  private async saveRegistry(registryFile: string): Promise<void> {
    await fs.mkdir(path.dirname(registryFile), { recursive: true });

    const jsonStr = JSON.stringify(this._vaults.map(v => ({
      name: v.name,
      path: v.path,
      createdAt: v.createdAt.toISOString(),
      lastAccessedAt: v.lastAccessedAt.toISOString()
    })));

    await fs.writeFile(registryFile, jsonStr, 'utf-8');
  }
}
