import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { S3SyncConfig } from '@baishou/shared'
import {
  shouldIncludeIncrementalSyncFile,
  shouldScanIncrementalSyncDirectory,
  migrateLegacyIncrementalSyncConfig
} from '@baishou/shared'
import type { ICloudSyncClient } from '../network/cloud-sync.interface'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { IVersionManager } from './version-manager.interface'
import { DEFAULT_S3_SYNC_CONFIG, S3_CONFIG_FILE } from './three-way-sync.constants'

export abstract class ThreeWaySyncCore {
  protected config: S3SyncConfig = { ...DEFAULT_S3_SYNC_CONFIG }
  protected lastConflicts: string[] = []
  protected readonly configFileName = S3_CONFIG_FILE

  constructor(
    protected readonly pathService: IStoragePathService,
    protected readonly cloudClient: ICloudSyncClient,
    protected readonly deviceId: string,
    protected readonly versionManager?: IVersionManager
  ) {}

  /** 增量同步根：全部工作区所在的存储根目录 */
  protected async getSyncRoot(): Promise<string> {
    return this.pathService.getRootDirectory()
  }

  protected async getSyncMetaDirectory(): Promise<string> {
    const root = await this.getSyncRoot()
    return path.join(root, '.baishou')
  }

  protected async ensureRootConfigPath(): Promise<string> {
    const root = await this.getSyncRoot()
    const vaultPath = await this.pathService.getActiveVaultPath()
    return migrateLegacyIncrementalSyncConfig(root, vaultPath, {
      exists: (p) => fs.existsSync(p),
      read: (p) => fs.promises.readFile(p, 'utf8'),
      write: (p, content) => fs.promises.writeFile(p, content, 'utf8'),
      unlink: (p) => fs.promises.unlink(p)
    })
  }

  protected async resolveConfigPath(): Promise<string> {
    return this.ensureRootConfigPath()
  }

  protected async loadConfig(): Promise<void> {
    const configPath = await this.ensureRootConfigPath()

    if (fs.existsSync(configPath)) {
      try {
        const raw = await fs.promises.readFile(configPath, 'utf8')
        const saved = JSON.parse(raw) as Partial<S3SyncConfig>
        this.config = { ...DEFAULT_S3_SYNC_CONFIG, ...saved }
      } catch {
        this.config = { ...DEFAULT_S3_SYNC_CONFIG }
      }
    }
  }

  protected async saveConfig(): Promise<void> {
    const configPath = await this.ensureRootConfigPath()
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8')
  }

  protected async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  }

  protected async scanLocalFiles(): Promise<string[]> {
    const syncRoot = await this.getSyncRoot()
    const files: string[] = []

    const scan = async (dir: string, relativePath: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name
        if (entry.isDirectory()) {
          if (shouldScanIncrementalSyncDirectory(entry.name, relPath)) {
            await scan(fullPath, relPath)
          }
        } else if (shouldIncludeIncrementalSyncFile(entry.name, relPath)) {
          files.push(relPath.replace(/\\/g, '/'))
        }
      }
    }

    await scan(syncRoot, '')
    return files
  }
}
