import { join } from 'path'
import * as fs from 'fs/promises'
import type { IStoragePathService } from '@baishou/core-desktop'
import { DesktopStoragePathService } from './path.service'

/**
 * 将路径解析固定到指定 Vault，用于迁移时在不切换活动 Vault 的情况下写入目标空间。
 */
export class VaultScopedStoragePathService implements IStoragePathService {
  constructor(
    private readonly base: DesktopStoragePathService,
    private readonly vaultName: string
  ) {}

  getGlobalRegistryDirectory(): Promise<string> {
    return this.base.getGlobalRegistryDirectory()
  }

  getActiveVaultPath(): Promise<string | null> {
    return this.base.getVaultDirectory(this.vaultName)
  }

  getVaultDirectory(vaultName: string): Promise<string> {
    return this.base.getVaultDirectory(vaultName)
  }

  getVaultSystemDirectory(vaultName: string): Promise<string> {
    return this.base.getVaultSystemDirectory(vaultName)
  }

  getActiveVaultSettingsDirectory(): Promise<string> {
    return this.base.getVaultSystemDirectory(this.vaultName)
  }

  getGlobalShadowIndexDirectory(): Promise<string> {
    return this.base.getGlobalShadowIndexDirectory()
  }

  getRootDirectory(): Promise<string> {
    return this.base.getRootDirectory()
  }

  getSnapshotsDirectory(): Promise<string> {
    return this.base.getSnapshotsDirectory()
  }

  private async vaultDir(): Promise<string> {
    return this.base.getVaultDirectory(this.vaultName)
  }

  async getJournalsBaseDirectory(): Promise<string> {
    const dir = join(await this.vaultDir(), 'Journals')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  async getSummariesBaseDirectory(): Promise<string> {
    const dir = join(await this.vaultDir(), 'Archives')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  async getLegacyArchivesDirectory(): Promise<string | null> {
    const dir = join(await this.vaultDir(), 'Archives')
    try {
      await fs.access(dir)
      return dir
    } catch {
      return null
    }
  }

  async getSessionsBaseDirectory(): Promise<string> {
    const dir = join(await this.vaultDir(), 'Sessions')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  async getAssistantsBaseDirectory(): Promise<string> {
    const dir = join(await this.vaultDir(), 'Assistants')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  async getAttachmentsBaseDirectory(): Promise<string> {
    const dir = join(await this.vaultDir(), 'attachments')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  getAvatarsDirectory(): Promise<string> {
    return this.base.getAvatarsDirectory()
  }

  getUserAvatarsDirectory(): Promise<string> {
    return this.base.getUserAvatarsDirectory()
  }

  getChatBackgroundsDirectory(): Promise<string> {
    return this.base.getChatBackgroundsDirectory()
  }

  async getDiaryAttachmentDirectory(date: Date): Promise<string> {
    const journalsDir = await this.getJournalsBaseDirectory()
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const dir = join(journalsDir, year, month, 'attachment')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  async getDiaryAttachmentDirectoryByYearMonth(yearMonth: string): Promise<string> {
    const journalsDir = await this.getJournalsBaseDirectory()
    const [year, month] = yearMonth.split('-')
    const dir = join(journalsDir, year!, month!, 'attachment')
    await fs.mkdir(dir, { recursive: true })
    return dir
  }
}
