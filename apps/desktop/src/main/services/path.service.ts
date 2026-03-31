import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IStoragePathService } from '@baishou/core';

export class DesktopStoragePathService implements IStoragePathService {
  private getSettingsFile(): string {
    return path.join(app.getPath('userData'), 'baishou_settings.json');
  }

  public async getCustomRootPath(): Promise<string | null> {
    try {
      const data = await fs.readFile(this.getSettingsFile(), 'utf-8');
      const settings = JSON.parse(data);
      return settings.custom_storage_root || null;
    } catch {
      return null;
    }
  }

  public async updateRootDirectory(newPath: string): Promise<void> {
    let settings: any = {};
    try {
      const data = await fs.readFile(this.getSettingsFile(), 'utf-8');
      settings = JSON.parse(data);
    } catch {}
    settings.custom_storage_root = newPath;
    await fs.writeFile(this.getSettingsFile(), JSON.stringify(settings, null, 2), 'utf-8');
  }

  public async getRootDirectory(): Promise<string> {
    const customPath = await this.getCustomRootPath();

    if (customPath && customPath.trim() !== '') {
      try {
        await fs.mkdir(customPath, { recursive: true });
        
        // 可写性测试 (Writeability test)
        const testFile = path.join(customPath, '.write_test');
        await fs.writeFile(testFile, 'test', 'utf-8');
        try {
          await fs.unlink(testFile);
        } catch (e) {
          // Ignore delete failure (e.g. windows locking)
        }
        return customPath;
      } catch (e) {
        console.warn(`StoragePathService: Custom path ${customPath} is not writable, falling back to default:`, e);
      }
    }

    // Default Fallback
    const rootDir = path.join(app.getPath('userData'), 'Vaults');
    await fs.mkdir(rootDir, { recursive: true });
    return rootDir;
  }

  public async getGlobalRegistryDirectory(): Promise<string> {
    // Registry lives in the pure userData directory permanently
    return app.getPath('userData');
  }

  public async getVaultDirectory(vaultName: string): Promise<string> {
    const root = await this.getRootDirectory();
    // sanitize
    const safeName = vaultName.replace(/[/\\]/g, '_');
    const vaultDir = path.join(root, safeName);
    await fs.mkdir(vaultDir, { recursive: true });
    return vaultDir;
  }

  public async getVaultSystemDirectory(vaultName: string): Promise<string> {
    const vaultDir = await this.getVaultDirectory(vaultName);
    const vaultSysDir = path.join(vaultDir, '.baishou');
    await fs.mkdir(vaultSysDir, { recursive: true });
    return vaultSysDir;
  }
}
