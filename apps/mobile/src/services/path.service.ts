import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { getAppDocumentDirectory } from './mobile-app-paths'
import {
  EXTERNAL_STORAGE_ROOT,
  ExternalStorageRequiredError,
  hasStoragePermission,
  openAllFilesAccessSettings as openAllFilesAccessSettingsPage,
  requestStoragePermission
} from './storage-permission.service'

export { EXTERNAL_STORAGE_ROOT }

/**
 * Android 数据根目录固定为 /storage/emulated/0/BaiShou_Root（EXTERNAL_STORAGE_ROOT）。
 * 必须授予「管理所有文件」权限；不回退应用沙盒，以便用户用文件管理器直接管理日记与总结。
 */
export class MobileStoragePathService implements IStoragePathService {
  constructor(private readonly fileSystem: IFileSystem) {}

  private customRootKey = 'baishou_custom_storage_root'

  public async getCustomRootPath(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(this.customRootKey)
      if (!stored) return null
      if (stored.includes('/emulated/0') && !stored.includes('/storage/emulated/0')) {
        const fixed = stored.replace('/emulated/0', '/storage/emulated/0')
        await AsyncStorage.setItem(this.customRootKey, fixed)
        return fixed
      }
      return stored
    } catch {
      return null
    }
  }

  public async updateRootDirectory(newPath: string): Promise<void> {
    await AsyncStorage.setItem(this.customRootKey, newPath)
  }

  /** 在已具备全文件访问权限时，应用固定的外部 BaiShou_Root（无需用户选择路径） */
  public async applyExternalRootWhenPermitted(): Promise<boolean> {
    if (Platform.OS !== 'android') return false
    if (!(await hasStoragePermission())) return false
    try {
      await this.ensureWritableDirectory(EXTERNAL_STORAGE_ROOT)
      await this.updateRootDirectory(EXTERNAL_STORAGE_ROOT)
      return true
    } catch {
      return false
    }
  }

  /** @deprecated 请使用 storage-permission.service 中的 requestStoragePermission */
  public async requestAllFilesAccess(): Promise<void> {
    await requestStoragePermission()
  }

  public async openAllFilesAccessSettings(): Promise<void> {
    await openAllFilesAccessSettingsPage()
  }

  private isExternalStoragePath(pathUri: string): boolean {
    return (
      pathUri.startsWith('file:///storage/') ||
      pathUri.startsWith('/storage/') ||
      pathUri.includes('/emulated/0/')
    )
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!(await this.fileSystem.exists(dir))) {
      await this.fileSystem.mkdir(dir, { recursive: true })
    }
  }

  private async ensureWritableDirectory(dirUri: string): Promise<string> {
    await this.ensureDir(dirUri)
    const testFile = `${dirUri}/.write_test`
    await this.fileSystem.writeFile(testFile, 'test')
    try {
      await this.fileSystem.unlink(testFile)
    } catch {
      // ignore cleanup errors
    }
    return dirUri
  }

  private async getSandboxRootDirectory(): Promise<string> {
    const base = getAppDocumentDirectory()
    const internalFallback = `${base}Vaults`
    return this.ensureWritableDirectory(internalFallback)
  }

  public async getRootDirectory(): Promise<string> {
    if (Platform.OS === 'android') {
      if (!(await hasStoragePermission())) {
        throw new ExternalStorageRequiredError()
      }

      const customPath = await this.getCustomRootPath()
      if (customPath && customPath.trim() !== '' && this.isExternalStoragePath(customPath)) {
        try {
          return await this.ensureWritableDirectory(customPath)
        } catch (e) {
          console.warn(`StoragePathService: Custom path ${customPath} inaccessible.`, e)
        }
      }

      const root = await this.ensureWritableDirectory(EXTERNAL_STORAGE_ROOT)
      void this.updateRootDirectory(EXTERNAL_STORAGE_ROOT)
      return root
    }

    const customPath = await this.getCustomRootPath()
    if (customPath && customPath.trim() !== '') {
      try {
        return await this.ensureWritableDirectory(customPath)
      } catch (e) {
        console.warn(`StoragePathService: Custom path ${customPath} inaccessible.`, e)
      }
    }

    try {
      return await this.ensureWritableDirectory(EXTERNAL_STORAGE_ROOT)
    } catch {
      return this.getSandboxRootDirectory()
    }
  }

  public async getGlobalRegistryDirectory(): Promise<string> {
    const base = getAppDocumentDirectory()
    const dir = `${base}.baishou_global`
    await this.ensureDir(dir)
    return dir
  }

  private async getActiveVaultName(): Promise<string> {
    try {
      const rootDir = await this.getRootDirectory()
      const registryFile = `${rootDir}/vault_registry.json`
      if (!(await this.fileSystem.exists(registryFile))) return 'Personal'
      const data = await this.fileSystem.readFile(registryFile)
      const vaults = JSON.parse(data) as Array<{ name: string; lastAccessedAt: string }>
      if (!Array.isArray(vaults) || vaults.length === 0) return 'Personal'
      const active = [...vaults].sort(
        (a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
      )[0]
      return active?.name || 'Personal'
    } catch {
      return 'Personal'
    }
  }

  public async getActiveVaultPath(): Promise<string | null> {
    try {
      return await this.getVaultDirectory(await this.getActiveVaultName())
    } catch {
      return null
    }
  }

  /** 供 MCP / 工具上下文使用 */
  public async getActiveVaultNameForContext(): Promise<string> {
    return this.getActiveVaultName()
  }

  public async getVaultDirectory(vaultName: string): Promise<string> {
    const root = await this.getRootDirectory()
    const safeName = vaultName.replace(/[/\\]/g, '_')
    const vaultDir = `${root}/${safeName}`
    await this.ensureDir(vaultDir)
    return vaultDir
  }

  public async getVaultSystemDirectory(vaultName: string): Promise<string> {
    const vaultDir = await this.getVaultDirectory(vaultName)
    const vaultSysDir = `${vaultDir}/.baishou`
    await this.ensureDir(vaultSysDir)
    return vaultSysDir
  }

  public async getSnapshotsDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/snapshots`
    await this.ensureDir(dir)
    return dir
  }

  public async getJournalsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultDirectory(name)}/Journals`
    await this.ensureDir(dir)
    return dir
  }

  public async getSummariesBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultDirectory(name)}/Archives`
    await this.ensureDir(dir)
    return dir
  }

  public async getLegacyArchivesDirectory(): Promise<string | null> {
    const dir = await this.getSummariesBaseDirectory()
    try {
      if (await this.fileSystem.exists(dir)) return dir
    } catch {
      // ignore
    }
    return null
  }

  public async getSessionsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/sessions`
    await this.ensureDir(dir)
    return dir
  }

  public async getAssistantsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/assistants`
    await this.ensureDir(dir)
    return dir
  }

  public async getAttachmentsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/attachments`
    await this.ensureDir(dir)
    return dir
  }

  public async getAvatarsDirectory(): Promise<string> {
    const att = await this.getAttachmentsBaseDirectory()
    const dir = `${att}/avatars`
    await this.ensureDir(dir)
    return dir
  }

  public async getDiaryAttachmentDirectory(date: Date): Promise<string> {
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return this.getDiaryAttachmentDirectoryByYearMonth(ym)
  }

  public async getDiaryAttachmentDirectoryByYearMonth(yearMonth: string): Promise<string> {
    const journals = await this.getJournalsBaseDirectory()
    const [y, m] = yearMonth.split('-')
    const dir = `${journals}/${y}/${m}/attachment`
    await this.ensureDir(dir)
    return dir
  }

  public async getAttachmentsBaseDirectory(): Promise<string> {
    const vaultDir = await this.getVaultDirectory('default')
    const dir = `${vaultDir}/Attachments`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }

  public async getAvatarsDirectory(): Promise<string> {
    const attDir = await this.getAttachmentsBaseDirectory()
    const dir = `${attDir}/avatars`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }

  public async getUserAvatarsDirectory(): Promise<string> {
    const root = FileSystem.documentDirectory
    if (!root) {
      return this.getAvatarsDirectory()
    }
    const dir = `${root}UserAvatars`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }

  public async getDiaryAttachmentDirectory(date: Date): Promise<string> {
    const journalsDir = await this.getJournalsBaseDirectory()
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const dir = `${journalsDir}/${year}/${month}/attachment`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }

  public async getDiaryAttachmentDirectoryByYearMonth(yearMonth: string): Promise<string> {
    const [year, month] = yearMonth.split('-')
    const journalsDir = await this.getJournalsBaseDirectory()
    const dir = `${journalsDir}/${year}/${month}/attachment`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }
}
