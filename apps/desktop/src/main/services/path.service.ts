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
        const testFile = path.join(customPath, `.write_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
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

  private async getActiveVaultName(): Promise<string> {
    try {
      const rootDir = await this.getRootDirectory();
      const registryFile = path.join(rootDir, 'vault_registry.json');
      const data = await fs.readFile(registryFile, 'utf-8');
      const vaults = JSON.parse(data);
      if (vaults.length === 0) return 'Personal';
      const active = vaults.sort((a: any, b: any) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())[0];
      return active?.name || 'Personal';
    } catch {
      return 'Personal';
    }
  }

  private async getActiveVaultDirectory(): Promise<string> {
    return this.getVaultDirectory(await this.getActiveVaultName());
  }

  public async getSnapshotsDirectory(): Promise<string> {
    const root = await this.getRootDirectory();
    const dir = path.join(root, '.snapshots');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  public async getJournalsBaseDirectory(): Promise<string> {
    const activeDir = await this.getActiveVaultDirectory();
    const dir = path.join(activeDir, 'Journals');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  public async getSummariesBaseDirectory(): Promise<string> {
    const activeDir = await this.getActiveVaultDirectory();
    const dir = path.join(activeDir, 'Summaries');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  public async getSessionsBaseDirectory(): Promise<string> {
    const activeDir = await this.getActiveVaultDirectory();
    const dir = path.join(activeDir, 'Sessions');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  public async getAssistantsBaseDirectory(): Promise<string> {
    const activeDir = await this.getActiveVaultDirectory();
    const dir = path.join(activeDir, 'Assistants');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  public async getAttachmentsBaseDirectory(): Promise<string> {
    const activeDir = await this.getActiveVaultDirectory();
    const dir = path.join(activeDir, 'Attachments');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  public async getAvatarsDirectory(): Promise<string> {
    const attDir = await this.getAttachmentsBaseDirectory();
    const dir = path.join(attDir, 'avatars');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * 获取日记附件目录
   * 路径结构: Vault/Journals/{year}/{month}/attachment/
   * @param date 日期对象，用于确定年月
   */
  public async getDiaryAttachmentDirectory(date: Date): Promise<string> {
    const journalsDir = await this.getJournalsBaseDirectory();
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const dir = path.join(journalsDir, year, month, 'attachment');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  /**
   * 获取日记附件目录（根据年月字符串）
   * @param yearMonth 格式: "2026-05"
   */
  public async getDiaryAttachmentDirectoryByYearMonth(yearMonth: string): Promise<string> {
    const journalsDir = await this.getJournalsBaseDirectory();
    const [year, month] = yearMonth.split('-');
    const dir = path.join(journalsDir, year!, month!, 'attachment');
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
}
