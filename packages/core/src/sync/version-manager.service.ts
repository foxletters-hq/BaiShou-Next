import * as fs from 'fs';
import * as path from 'path';
import type { VersionSnapshot } from '@baishou/shared';
import type { IVersionManager } from './version-manager.interface';
import type { IStoragePathService } from '../vault/storage-path.types';
import {
  VersionBackupError,
  VersionRestoreError,
  VersionNotFoundError,
} from './sync.errors';

export class VersionManagerImpl implements IVersionManager {
  constructor(private readonly pathService: IStoragePathService) {}

  // ── 内部辅助 ───────────────────────────────────────────────

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath();
    if (!vaultPath) {
      throw new VersionBackupError(new Error('No active vault found'));
    }
    return vaultPath;
  }

  private async getVersionsDir(): Promise<string> {
    const vaultPath = await this.getVaultPath();
    return path.join(vaultPath, '.versions');
  }

  private async getFileVersionsDir(filePath: string): Promise<string> {
    const versionsDir = await this.getVersionsDir();
    return path.join(versionsDir, filePath);
  }

  private async ensureDir(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  }

  // ── 公开 API ───────────────────────────────────────────────

  async backup(filePath: string): Promise<string> {
    try {
      const vaultPath = await this.getVaultPath();
      const fullPath = path.join(vaultPath, filePath);

      if (!fs.existsSync(fullPath)) {
        throw new VersionBackupError(new Error('File not found'));
      }

      const versionsDir = await this.getFileVersionsDir(filePath);
      await this.ensureDir(versionsDir);

      const versionId = Date.now();
      const backupPath = path.join(versionsDir, `${versionId}.md`);

      await fs.promises.copyFile(fullPath, backupPath);

      // 保存版本元信息
      const metaPath = path.join(versionsDir, `${versionId}.json`);
      const stat = await fs.promises.stat(fullPath);
      const meta: VersionSnapshot = {
        id: versionId,
        filePath,
        size: stat.size,
        createdAt: new Date(),
        reason: 'edit',
      };

      await fs.promises.writeFile(
        metaPath,
        JSON.stringify(meta, null, 2),
        'utf8'
      );

      return backupPath;
    } catch (error) {
      if (error instanceof VersionBackupError) {
        throw error;
      }
      throw new VersionBackupError(error instanceof Error ? error : undefined);
    }
  }

  async backupBatch(filePaths: string[]): Promise<string[]> {
    const results: string[] = [];

    for (const filePath of filePaths) {
      const backupPath = await this.backup(filePath);
      results.push(backupPath);
    }

    return results;
  }

  async getVersions(filePath: string): Promise<VersionSnapshot[]> {
    const versionsDir = await this.getFileVersionsDir(filePath);

    if (!fs.existsSync(versionsDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(versionsDir);
    const metaFiles = entries.filter((e) => e.endsWith('.json'));

    const versions: VersionSnapshot[] = [];

    for (const metaFile of metaFiles) {
      try {
        const metaPath = path.join(versionsDir, metaFile);
        const raw = await fs.promises.readFile(metaPath, 'utf8');
        const meta = JSON.parse(raw) as VersionSnapshot;
        versions.push(meta);
      } catch {
        // 跳过损坏的元文件
      }
    }

    // 按时间倒序排序
    return versions.sort((a, b) => b.id - a.id);
  }

  async restore(filePath: string, versionId: number): Promise<void> {
    const versionsDir = await this.getFileVersionsDir(filePath);
    const backupPath = path.join(versionsDir, `${versionId}.md`);
    const metaPath = path.join(versionsDir, `${versionId}.json`);

    if (!fs.existsSync(backupPath) || !fs.existsSync(metaPath)) {
      throw new VersionNotFoundError(versionId);
    }

    try {
      const vaultPath = await this.getVaultPath();
      const fullPath = path.join(vaultPath, filePath);

      // 确保目标目录存在
      const dir = path.dirname(fullPath);
      await this.ensureDir(dir);

      await fs.promises.copyFile(backupPath, fullPath);
    } catch (error) {
      throw new VersionRestoreError(error instanceof Error ? error : undefined);
    }
  }

  async cleanup(filePath: string, keepCount = 10): Promise<void> {
    const versions = await this.getVersions(filePath);

    if (versions.length <= keepCount) {
      return;
    }

    const versionsDir = await this.getFileVersionsDir(filePath);
    const toDelete = versions.slice(keepCount);

    for (const version of toDelete) {
      const backupPath = path.join(versionsDir, `${version.id}.md`);
      const metaPath = path.join(versionsDir, `${version.id}.json`);

      try {
        if (fs.existsSync(backupPath)) {
          await fs.promises.unlink(backupPath);
        }
        if (fs.existsSync(metaPath)) {
          await fs.promises.unlink(metaPath);
        }
      } catch {
        // 忽略删除错误
      }
    }
  }
}
