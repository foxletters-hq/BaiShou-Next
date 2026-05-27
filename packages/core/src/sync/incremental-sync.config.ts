import * as fs from 'fs'
import * as path from 'path'
import type { S3SyncConfig } from '@baishou/shared'
import type { IStoragePathService } from '../vault/storage-path.types'
import {
  DEFAULT_S3_SYNC_CONFIG,
  INCREMENTAL_SYNC_CONFIG_FILENAME
} from './incremental-sync.constants'

export class IncrementalSyncConfigStore {
  constructor(
    private readonly pathService: IStoragePathService,
    readonly config: S3SyncConfig = { ...DEFAULT_S3_SYNC_CONFIG }
  ) {}

  private async getVaultPath(): Promise<string> {
    const vaultPath = await this.pathService.getActiveVaultPath()
    if (!vaultPath) {
      throw new Error('No active vault found')
    }
    return vaultPath
  }

  async loadConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const configPath = path.join(vaultPath, INCREMENTAL_SYNC_CONFIG_FILENAME)

    if (fs.existsSync(configPath)) {
      try {
        const raw = await fs.promises.readFile(configPath, 'utf8')
        const saved = JSON.parse(raw) as Partial<S3SyncConfig>
        Object.assign(this.config, DEFAULT_S3_SYNC_CONFIG, saved)
      } catch {
        Object.assign(this.config, DEFAULT_S3_SYNC_CONFIG)
      }
    }
  }

  async saveConfig(): Promise<void> {
    const vaultPath = await this.getVaultPath()
    const configPath = path.join(vaultPath, INCREMENTAL_SYNC_CONFIG_FILENAME)
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2), 'utf8')
  }
}
