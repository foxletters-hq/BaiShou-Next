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
import {
  S3NotConfiguredError,
  S3ConnectionError,
  S3SyncError,
} from './sync.errors';

const MANIFEST_FILENAME = 'manifest.json';
const DEFAULT_CONFIG: S3SyncConfig = {
  enabled: false,
  endpoint: '',
  region: '',
  bucket: '',
  path: 'baishou/',
  accessKey: '',
  secretKey: '',
};

export class IncrementalSyncServiceImpl implements IIncrementalSyncService {
  private config: S3SyncConfig = { ...DEFAULT_CONFIG };
  private lastConflicts: string[] = [];
  private readonly configFileName = '.baishou-s3.json';

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly cloudClient: ICloudSyncClient,
    private readonly deviceId: string,
  ) {}

  // ── 内部辅助 ───────────────────────────────────────────────

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

    await fs.promises.writeFile(
      configPath,
      JSON.stringify(this.config, null, 2),
      'utf8'
    );
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
          // 跳过隐藏目录和版本目录
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

  private async buildLocalManifest(): Promise<SyncManifest> {
    const vaultPath = await this.getVaultPath();
    const files = await this.scanLocalFiles();
    const manifest: SyncManifest = {
      version: 1,
      updatedAt: Date.now(),
      deviceId: this.deviceId,
      files: {},
    };

    for (const relPath of files) {
      const fullPath = path.join(vaultPath, relPath);
      const stat = await fs.promises.stat(fullPath);
      const hash = await this.computeFileHash(fullPath);

      manifest.files[relPath] = {
        hash,
        size: stat.size,
        lastModified: stat.mtimeMs,
      };
    }

    return manifest;
  }

  private async getLocalManifestPath(): Promise<string> {
    const vaultPath = await this.getVaultPath();
    return path.join(vaultPath, '.baishou', MANIFEST_FILENAME);
  }

  private async saveLocalManifest(manifest: SyncManifest): Promise<void> {
    const manifestPath = await this.getLocalManifestPath();
    const dir = path.dirname(manifestPath);

    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }

  private async loadLocalManifest(): Promise<SyncManifest | null> {
    const manifestPath = await this.getLocalManifestPath();

    if (!fs.existsSync(manifestPath)) {
      return null;
    }

    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf8');
      return JSON.parse(raw) as SyncManifest;
    } catch {
      return null;
    }
  }

  private async uploadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);

    await this.cloudClient.uploadFile(fullPath);
  }

  private async downloadFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);
    const remotePath = this.config.path + relPath;

    // 确保目录存在
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await this.cloudClient.downloadFile(remotePath, fullPath);
  }

  private async backupFile(relPath: string): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const fullPath = path.join(vaultPath, relPath);
    const backupDir = path.join(vaultPath, '.versions', relPath);
    const backupFile = path.join(backupDir, `${Date.now()}.md`);

    if (fs.existsSync(fullPath)) {
      const dir = path.dirname(backupFile);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.copyFile(fullPath, backupFile);
    }
  }

  // ── 公开 API ───────────────────────────────────────────────

  async getConfig(): Promise<S3SyncConfig> {
    await this.loadConfig();
    return { ...this.config };
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

  async sync(): Promise<IncrementalSyncResult> {
    if (!this.config.enabled) {
      throw new S3NotConfiguredError();
    }

    const startTime = Date.now();
    const result: IncrementalSyncResult = {
      uploaded: [],
      downloaded: [],
      conflicted: [],
      skipped: [],
      duration: 0,
    };

    try {
      // 1. 获取本地和远端 manifest
      const localManifest = await this.buildLocalManifest();
      const remoteManifest = await this.getRemoteManifest();

      // 2. 比较差异
      const localFiles = Object.keys(localManifest.files);
      const remoteFiles = Object.keys(remoteManifest.files);
      const allFiles = new Set([...localFiles, ...remoteFiles]);

      for (const relPath of allFiles) {
        const localEntry = localManifest.files[relPath];
        const remoteEntry = remoteManifest.files[relPath];

        if (!localEntry && remoteEntry) {
          // 远端有，本地无 → 下载
          await this.downloadFile(relPath);
          result.downloaded.push(relPath);
        } else if (localEntry && !remoteEntry) {
          // 本地有，远端无 → 上传
          await this.uploadFile(relPath);
          result.uploaded.push(relPath);
        } else if (localEntry && remoteEntry) {
          if (localEntry.hash === remoteEntry.hash) {
            // 相同 → 跳过
            result.skipped.push(relPath);
          } else {
            // 不同 → Last-Write-Wins
            result.conflicted.push(relPath);

            if (localEntry.lastModified > remoteEntry.lastModified) {
              // 本地更新 → 上传
              await this.uploadFile(relPath);
              result.uploaded.push(relPath);
            } else {
              // 远端更新 → 下载（备份本地版本）
              await this.backupFile(relPath);
              await this.downloadFile(relPath);
              result.downloaded.push(relPath);
            }
          }
        }
      }

      // 3. 更新本地 manifest
      await this.saveLocalManifest(localManifest);

      // 4. 上传新的 manifest
      const manifestPath = await this.getLocalManifestPath();
      await this.cloudClient.uploadFile(manifestPath);

      this.lastConflicts = result.conflicted;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      throw new S3SyncError(
        'Sync failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  async uploadOnly(): Promise<IncrementalSyncResult> {
    if (!this.config.enabled) {
      throw new S3NotConfiguredError();
    }

    const startTime = Date.now();
    const result: IncrementalSyncResult = {
      uploaded: [],
      downloaded: [],
      conflicted: [],
      skipped: [],
      duration: 0,
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
      const manifestPath = await this.getLocalManifestPath();
      await this.cloudClient.uploadFile(manifestPath);

      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      throw new S3SyncError(
        'Upload failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  async downloadOnly(): Promise<IncrementalSyncResult> {
    if (!this.config.enabled) {
      throw new S3NotConfiguredError();
    }

    const startTime = Date.now();
    const result: IncrementalSyncResult = {
      uploaded: [],
      downloaded: [],
      conflicted: [],
      skipped: [],
      duration: 0,
    };

    try {
      const localManifest = await this.buildLocalManifest();
      const remoteManifest = await this.getRemoteManifest();

      for (const [relPath, remoteEntry] of Object.entries(remoteManifest.files)) {
        const localEntry = localManifest.files[relPath];

        if (!localEntry || localEntry.hash !== remoteEntry.hash) {
          if (localEntry) {
            await this.backupFile(relPath);
          }
          await this.downloadFile(relPath);
          result.downloaded.push(relPath);
        } else {
          result.skipped.push(relPath);
        }
      }

      await this.saveLocalManifest(localManifest);
      result.duration = Date.now() - startTime;
      return result;
    } catch (error) {
      throw new S3SyncError(
        'Download failed',
        error instanceof Error ? error : undefined
      );
    }
  }

  async getLocalManifest(): Promise<SyncManifest> {
    const saved = await this.loadLocalManifest();
    if (saved) {
      return saved;
    }
    return this.buildLocalManifest();
  }

  async getRemoteManifest(): Promise<SyncManifest> {
    try {
      const files = await this.cloudClient.listFiles();
      const manifestFile = files.find(
        (f) => f.filename === this.config.path + MANIFEST_FILENAME
      );

      if (!manifestFile) {
        return {
          version: 1,
          updatedAt: 0,
          deviceId: '',
          files: {},
        };
      }

      // 下载 manifest 文件
      const tempPath = path.join(
        await this.getVaultPath(),
        '.baishou',
        'temp-manifest.json'
      );
      await this.cloudClient.downloadFile(manifestFile.filename, tempPath);

      const raw = await fs.promises.readFile(tempPath, 'utf8');
      await fs.promises.unlink(tempPath);

      return JSON.parse(raw) as SyncManifest;
    } catch (error) {
      throw new S3ConnectionError(
        error instanceof Error ? error : undefined
      );
    }
  }

  async refreshLocalManifest(): Promise<SyncManifest> {
    const manifest = await this.buildLocalManifest();
    await this.saveLocalManifest(manifest);
    return manifest;
  }

  getLastSyncConflicts(): Promise<string[]> {
    return Promise.resolve(this.lastConflicts);
  }
}
