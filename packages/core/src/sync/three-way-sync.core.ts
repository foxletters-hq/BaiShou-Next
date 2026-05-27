import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type { S3SyncConfig } from '@baishou/shared'
import type { ICloudSyncClient } from '../network/cloud-sync.interface'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { IVersionManager } from './version-manager.interface'
import { S3SyncError } from './sync.errors'
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

  protected async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath()
    if (!vaultPath) {
      throw new S3SyncError('No active vault found')
    }
    return vaultPath
  }

  protected async loadConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const configPath = path.join(vaultPath, this.configFileName)

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
    const vaultPath = await this.getVaultPath()
    const configPath = path.join(vaultPath, this.configFileName)
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8')
  }

  protected async computeFileHash(filePath: string): Promise<string> {
    const content = await fs.promises.readFile(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  }

  protected async scanLocalFiles(): Promise<string[]> {
    const vaultPath = await this.getVaultPath()
    const files: string[] = []

    const scan = async (dir: string, relativePath: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relPath = path.join(relativePath, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath, relPath)
          }
        } else if (!entry.name.startsWith('.')) {
          files.push(relPath.replace(/\\/g, '/'))
        }
      }
    }

    await scan(vaultPath, '')
    return files
  }
}
