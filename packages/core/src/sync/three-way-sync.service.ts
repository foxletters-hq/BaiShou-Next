import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type {
  S3SyncConfig,
  SyncManifest,
  IncrementalSyncResult,
} from '@baishou/shared';
import type { IIncrementalSyncService } from './incremental-sync.interface';
import type { ICloudSyncClient } from '../network/cloud-sync.interface';
import type { IStoragePathService } from '../vault/storage-path.types';
import type { IVersionManager } from './version-manager.interface';
import { threeWayMerge } from './three-way-merge';
import {
  S3NotConfiguredError,
  S3SyncError,
} from './sync.errors';

const MANIFEST_FILENAME_V2 = 'manifest-v2.json';
const REMOTE_SNAPSHOT_FILENAME = 'last-remote-manifest.json';
const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: '',
  bucket: '',
  path: 'baishou/',
  accessKey: '',
  secretKey: '',
};

/**
 * 三向合并增量同步服务 V2
 *
 * 与旧版 IncrementalSyncServiceImpl 独立共存。
 * 采用三向合并算法（本地 vs 远程 vs 祖先），支持删除传播。
 *
 * 旧版 IPC 通道 (incrementalSync:sync) 仍然使用旧服务，
 * 新版编排器 IPC 通道 (incrementalSync:orchestratedSync) 使用本服务。
 */
export class ThreeWaySyncService implements IIncrementalSyncService {
  private config: S3SyncConfig = { ...DEFAULT_CONFIG };
  private lastConflicts: string[] = [];
  private readonly configFileName = '.baishou-s3.json';

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly cloudClient: ICloudSyncClient,
    private readonly deviceId: string,
    private readonly versionManager?: IVersionManager,
  ) {}

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath();
    if (!vaultPath) {
      throw new S3SyncError('No active vault found');
    }
    return vaultPath;
  }

  private async loadConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const configPath = path.join(vaultPath, this.configFileName);

    if (fs.existsSync(configPath)) {
      try {
        const raw = await fs.promises.readFile(configPath, 'utf8');
        const saved = JSON.parse(raw) as Partial<S3SyncConfig>;
        this.config = { ...DEFAULT_CONFIG, ...saved };
      } catch {
        this.config = { ...DEFAULT_CONFIG };
      }
    }
  }

  private async saveConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const configPath = path.join(vaultPath, this.configFileName);
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  private async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  private async scanLocalFiles(): Promise<string[]> {
    const vaultPath = await this.getVaultPath();
    const files: string[] = [];

    const scan = async (dir: string, relativePath: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath, relPath);
          }
        } else if (!entry.name.startsWith('.')) {
          files.push(relPath);
        }
      }
    };

    await scan(vaultPath, '');
    return files;
  }

  // ── 配置 ───────────────────────────────────────────────────

  async getConfig(): Promise<S3SyncConfig> {
    await this.loadConfig();
    return this.config;
  }

  async updateConfig(config: Partial<S3SyncConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.cloudClient.listFiles();
      return true;
    } catch {
      return false;
    }
  }

  // ── 同步操作 ───────────────────────────────────────────────

  async sync(): Promise<IncrementalSyncResult> {
    if (!this.config.enabled) throw new S3NotConfiguredError();

    const startTime = Date.now();
    const result: IncrementalSyncResult = {
      uploaded: [],
      downloaded: [],
      conflicted: [],
      skipped: [],
      deletedRemote: [],
      deletedLocal: [],
      duration: 0,
      sessionId: '',
    };

    try {
      const localManifest = await this.buildLocalManifest();
      const remoteManifest = await this.getRemoteManifest();
      const ancestorSnapshot = await this.getRemoteSnapshot();

      const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot);

      for (const d of decisions) {
        switch (d.type) {
          case 'upload':
            await this.uploadFile(d.filePath);
            result.uploaded.push(d.filePath);
            break;
          case 'download':
            await this.downloadFile(d.filePath);
            result.downloaded.push(d.filePath);
            break;
          case 'delete-remote':
            await this.deleteRemoteFile(d.filePath);
            result.deletedRemote.push(d.filePath);
            break;
          case 'delete-local':
            await this.deleteLocalFile(d.filePath);
            result.deletedLocal.push(d.filePath);
            break;
          case 'conflict-resolved': {
            result.conflicted.push(d.filePath);
            if (d.direction === 'upload') {
              if (d.localEntry) await this.backupFile(d.filePath, d.localEntry.hash);
              await this.uploadFile(d.filePath);
              result.uploaded.push(d.filePath);
            } else {
              if (d.localEntry) await this.backupFile(d.filePath, d.localEntry.hash);
              await this.downloadFile(d.filePath);
              result.downloaded.push(d.filePath);
            }
            break;
          }
          case 'skip':
            result.skipped.push(d.filePath);
            break;
        }
      }

      // 更新本地 manifest 和远程 manifest
      const finalManifest = await this.buildLocalManifest();
      await this.saveLocalManifest(finalManifest);
      await this.uploadManifest();

      // 更新远程快照（以最终一致状态作为下次的共同祖先）
      await this.saveRemoteSnapshot(finalManifest);

      this.lastConflicts = result.conflicted;
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      throw new S3SyncError('Three-way sync failed', error instanceof Error ? error : undefined);
    }
  }

  async uploadOnly(): Promise<IncrementalSyncResult> {
    if (!this.config.enabled) throw new S3NotConfiguredError();

    const startTime = Date.now();
    const result: IncrementalSyncResult = {
      uploaded: [], downloaded: [], conflicted: [], skipped: [],
      deletedRemote: [], deletedLocal: [], duration: 0, sessionId: '',
    };

    try {
      const localManifest = await this.buildLocalManifest();
      const remoteManifest = await this.getRemoteManifest();

      for (const [relPath, localEntry] of Object.entries(localManifest.files)) {
        const remoteEntry = remoteManifest.files[relPath];
        if (!remoteEntry || remoteEntry.hash !== localEntry.hash) {
          await this.uploadFile(relPath);
          result.uploaded.push(relPath);
        } else {
          result.skipped.push(relPath);
        }
      }

      await this.saveLocalManifest(localManifest);
      await this.uploadManifest();
      await this.saveRemoteSnapshot(localManifest);

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      throw new S3SyncError('Upload failed', error instanceof Error ? error : undefined);
    }
  }

  async downloadOnly(): Promise<IncrementalSyncResult> {
    if (!this.config.enabled) throw new S3NotConfiguredError();

    const startTime = Date.now();
    const result: IncrementalSyncResult = {
      uploaded: [], downloaded: [], conflicted: [], skipped: [],
      deletedRemote: [], deletedLocal: [], duration: 0, sessionId: '',
    };

    try {
      const localManifest = await this.buildLocalManifest();
      const remoteManifest = await this.getRemoteManifest();
      const ancestorSnapshot = await this.getRemoteSnapshot();

      const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot);

      for (const d of decisions) {
        if (d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')) {
          await this.downloadFile(d.filePath);
          result.downloaded.push(d.filePath);
        } else if (d.type === 'delete-local') {
          await this.deleteLocalFile(d.filePath);
          result.deletedLocal.push(d.filePath);
        } else if (d.type === 'skip') {
          result.skipped.push(d.filePath);
        }
      }

      const finalLocal = await this.buildLocalManifest();
      await this.saveLocalManifest(finalLocal);
      await this.saveRemoteSnapshot(finalLocal);
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      throw new S3SyncError('Download failed', error instanceof Error ? error : undefined);
    }
  }

  // ── 清单管理 ───────────────────────────────────────────────

  async buildLocalManifest(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath();
    const files = await this.scanLocalFiles();
    const manifest: SyncManifest = {
      version: 2,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {},
    };

    for (const relPath of files) {
      const fullPath = path.join(vaultPath, relPath);
      try {
        const hash = await this.computeFileHash(fullPath);
        const stat = await fs.promises.stat(fullPath);
        manifest.files[relPath] = {
          hash,
          size: stat.size,
          lastModified: stat.mtimeMs,
        };
      } catch {
        // 文件在扫描后被删除，跳过
      }
    }

    return manifest;
  }

  async getLocalManifest(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath();
    const manifestPath = path.join(vaultPath, '.baishou', MANIFEST_FILENAME_V2);

    if (fs.existsSync(manifestPath)) {
      const raw = await fs.promises.readFile(manifestPath, 'utf8');
      return JSON.parse(raw) as SyncManifest;
    }

    return { version: 2, updatedAt: 0, deviceId: '', files: {} };
  }

  async getRemoteManifest(): Promise<SyncManifest> {
    const remoteFiles = await this.cloudClient.listFiles();
    const manifestFile = remoteFiles.find((f) => f.filename === MANIFEST_FILENAME_V2);

    if (!manifestFile) {
      return { version: 2, updatedAt: 0, deviceId: '', files: {} };
    }

    const vaultPath = await this.getVaultPath();
    const tempPath = path.join(vaultPath, '.baishou', `temp-remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
    await fs.promises.mkdir(path.join(vaultPath, '.baishou'), { recursive: true });
    await this.cloudClient.downloadFile(manifestFile.filename, tempPath);

    try {
      const raw = await fs.promises.readFile(tempPath, 'utf8');
      return JSON.parse(raw) as SyncManifest;
    } finally {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }

  async getRemoteSnapshot(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath();
    const snapshotPath = path.join(vaultPath, '.baishou', REMOTE_SNAPSHOT_FILENAME);

    if (fs.existsSync(snapshotPath)) {
      try {
        const raw = await fs.promises.readFile(snapshotPath, 'utf8');
        return JSON.parse(raw) as SyncManifest;
      } catch {}
    }

    return { version: 2, updatedAt: 0, deviceId: '', files: {} };
  }

  getLastSyncConflicts(): Promise<string[]> {
    return Promise.resolve(this.lastConflicts);
  }

  // ── 内部方法 ───────────────────────────────────────────────

  private async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const manifestPath = path.join(vaultPath, '.baishou', MANIFEST_FILENAME_V2);
    await fs.promises.mkdir(path.join(vaultPath, '.baishou'), { recursive: true });
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  private async uploadManifest(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const manifestPath = path.join(vaultPath, '.baishou', MANIFEST_FILENAME_V2);
    if (fs.existsSync(manifestPath)) {
      await this.cloudClient.uploadFile(manifestPath);
    }
  }

  private async saveRemoteSnapshot(manifest: SyncManifest): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const snapshotPath = path.join(vaultPath, '.baishou', REMOTE_SNAPSHOT_FILENAME);
    await fs.promises.mkdir(path.join(vaultPath, '.baishou'), { recursive: true });
    await fs.promises.writeFile(snapshotPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  private async uploadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);
    if (fs.existsSync(fullPath)) {
      await this.cloudClient.uploadFile(fullPath);
    }
  }

  private async downloadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await this.cloudClient.downloadFile(relPath, fullPath);
  }

  private async deleteRemoteFile(relPath: string): Promise<void> {
    await this.cloudClient.deleteFile(relPath);
  }

  private async deleteLocalFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);
    if (fs.existsSync(fullPath)) {
      if (this.versionManager) {
        try {
          await this.versionManager.backup(fullPath);
        } catch {}
      } else {
        // 移动端无版本管理器时，创建 .conflict-* 备份
        try {
          const ext = path.extname(fullPath);
          const base = fullPath.slice(0, -ext.length || undefined);
          const ts = Date.now();
          const backupPath = `${base}.conflict-${ts}${ext}`;
          await fs.promises.copyFile(fullPath, backupPath);
        } catch {}
      }
      fs.unlinkSync(fullPath);
    }
  }

  private async backupFile(relPath: string, _hash: string): Promise<void> {
    if (!this.versionManager) return;
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);
    if (fs.existsSync(fullPath)) {
      try {
        await this.versionManager.backup(fullPath);
      } catch {}
    }
  }
}
