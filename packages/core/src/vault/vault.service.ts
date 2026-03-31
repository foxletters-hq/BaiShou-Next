import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IVaultService, VaultInfo } from './vault.types';
import { IStoragePathService } from './storage-path.types';
import { VaultActiveDeleteError, VaultNotFoundError } from './vault.errors';
import { IDatabaseConnectionManager } from '@baishou/database';

export class VaultService implements IVaultService {
  private _vaults: VaultInfo[] = [];

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly dbManager: IDatabaseConnectionManager
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
          // 容错匹配：移除路径末尾可能多余的横杠并将反斜杠转为正斜杠归一化后比对
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
    
    // Auto-connect to active vault at boot
    const activeVault = this.getActiveVault();
    if (activeVault) {
      await this.dbManager.connect(path.join(activeVault.path, 'data.db'));
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
    let targetPath = '';

    if (existingIndex !== -1) {
      const existing = this._vaults[existingIndex];
      if (existing) {
        existing.lastAccessedAt = new Date();
        targetPath = existing.path;
      }
    } else {
      const newPath = await this.pathService.getVaultDirectory(vaultName);
      // Ensure physical directories exist
      await fs.mkdir(newPath, { recursive: true });
      await fs.mkdir(await this.pathService.getVaultSystemDirectory(vaultName), { recursive: true });

      const newVault: VaultInfo = {
        name: vaultName,
        path: newPath,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };
      this._vaults.push(newVault);
      targetPath = newPath;
    }

    await this.saveRegistry(registryFile);
    await this.dbManager.connect(path.join(targetPath, 'data.db'));
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
      // Ignored: UI should handle this but specification says 'throw error' or ignore.
    }
  }

  private async saveRegistry(registryFile: string): Promise<void> {
    // Ensure dir exists
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
