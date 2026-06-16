import * as path from '../fs/path.util'
import { sanitizeVaultDirectoryName } from '../vault/vault-name.util'
import type { IStoragePathService } from '../vault/storage-path.types'

/**
 * 迁移阶段专用路径服务：所有读写指向目标 workspaceRoot + 指定 vault，
 * 避免头像/JSON 落到当前运行时 active root。
 */
export class MigrationTargetStoragePathService implements IStoragePathService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly activeVaultName: string = 'Personal'
  ) {}

  private vaultDir(vaultName?: string): string {
    const name = sanitizeVaultDirectoryName(vaultName ?? this.activeVaultName)
    return path.join(this.workspaceRoot, name)
  }

  async getGlobalRegistryDirectory(): Promise<string> {
    return path.join(this.workspaceRoot, '.baishou_global')
  }

  async getActiveVaultPath(): Promise<string | null> {
    return this.vaultDir()
  }

  async getVaultDirectory(vaultName: string): Promise<string> {
    return this.vaultDir(vaultName)
  }

  async getVaultSystemDirectory(vaultName: string): Promise<string> {
    return path.join(await this.getVaultDirectory(vaultName), '.baishou')
  }

  async getActiveVaultSettingsDirectory(): Promise<string> {
    return this.getVaultSystemDirectory(this.activeVaultName)
  }

  async getGlobalShadowIndexDirectory(): Promise<string> {
    return path.join(await this.getGlobalRegistryDirectory(), 'shadow_index')
  }

  async getRootDirectory(): Promise<string> {
    return this.workspaceRoot
  }

  async getSnapshotsDirectory(): Promise<string> {
    return path.join(this.workspaceRoot, '.snapshots')
  }

  async getJournalsBaseDirectory(): Promise<string> {
    return path.join(await this.vaultDir(), 'Journals')
  }

  async getSummariesBaseDirectory(): Promise<string> {
    return path.join(await this.vaultDir(), 'Archives')
  }

  async getLegacyArchivesDirectory(): Promise<string | null> {
    const dir = path.join(await this.vaultDir(), 'Archives')
    return dir
  }

  async getSessionsBaseDirectory(): Promise<string> {
    return path.join(await this.vaultDir(), 'Sessions')
  }

  async getAssistantsBaseDirectory(): Promise<string> {
    return path.join(await this.vaultDir(), 'Assistants')
  }

  async getAttachmentsBaseDirectory(): Promise<string> {
    return path.join(await this.vaultDir(), 'Attachments')
  }

  async getAvatarsDirectory(): Promise<string> {
    return path.join(await this.getAttachmentsBaseDirectory(), 'avatars')
  }

  async getUserAvatarsDirectory(): Promise<string> {
    return path.join(await this.getAvatarsDirectory(), 'UserAvatars')
  }

  async getDiaryAttachmentDirectory(date: Date): Promise<string> {
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return this.getDiaryAttachmentDirectoryByYearMonth(ym)
  }

  async getDiaryAttachmentDirectoryByYearMonth(yearMonth: string): Promise<string> {
    const [y, m] = yearMonth.split('-')
    return path.join(await this.getJournalsBaseDirectory(), y!, m!, 'attachment')
  }
}
