import * as FileSystem from 'expo-file-system/legacy'
import * as IntentLauncher from 'expo-intent-launcher'
import * as Application from 'expo-application'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { IStoragePathService } from '@baishou/core-mobile'

export class MobileStoragePathService implements IStoragePathService {
  private customRootKey = 'baishou_custom_storage_root'

  public async getCustomRootPath(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.customRootKey)
    } catch {
      return null
    }
  }

  public async updateRootDirectory(newPath: string): Promise<void> {
    await AsyncStorage.setItem(this.customRootKey, newPath)
  }

  public async requestAllFilesAccess(): Promise<void> {
    if (Application.applicationId) {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        { data: `package:${Application.applicationId}` }
      )
    }
  }

  public async getRootDirectory(): Promise<string> {
    const customPath = await this.getCustomRootPath()

    if (customPath && customPath.trim() !== '') {
      try {
        const info = await FileSystem.getInfoAsync(customPath)
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(customPath, { intermediates: true })
        }
        const testFile = `${customPath}/.write_test`
        await FileSystem.writeAsStringAsync(testFile, 'test')
        try {
          await FileSystem.deleteAsync(testFile, { idempotent: true })
        } catch {
          // ignore
        }
        return customPath
      } catch (e) {
        console.warn(`StoragePathService: Custom path ${customPath} inaccessible.`, e)
        await this.requestAllFilesAccess()
      }
    }

    const fallbackPath = 'file:///storage/emulated/0/BaiShou_Root'
    try {
      const info = await FileSystem.getInfoAsync(fallbackPath)
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(fallbackPath, { intermediates: true })
      }
      return fallbackPath
    } catch (e) {
      console.warn('Fallback to app sandbox', e)
      const base = FileSystem.documentDirectory || 'file:///data/user/0/com.anonymous.mobile/files/'
      const internalFallback = `${base}Vaults`
      const docInfo = await FileSystem.getInfoAsync(internalFallback)
      if (!docInfo.exists) {
        await FileSystem.makeDirectoryAsync(internalFallback, { intermediates: true })
      }
      return internalFallback
    }
  }

  public async getGlobalRegistryDirectory(): Promise<string> {
    const base = FileSystem.documentDirectory || 'file:///data/user/0/com.anonymous.mobile/files/'
    const dir = `${base}.baishou_global`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    }
    return dir
  }

  private async getActiveVaultName(): Promise<string> {
    try {
      const rootDir = await this.getRootDirectory()
      const registryFile = `${rootDir}/vault_registry.json`
      const info = await FileSystem.getInfoAsync(registryFile)
      if (!info.exists) return 'Personal'
      const data = await FileSystem.readAsStringAsync(registryFile)
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
    const info = await FileSystem.getInfoAsync(vaultDir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(vaultDir, { intermediates: true })
    }
    return vaultDir
  }

  public async getVaultSystemDirectory(vaultName: string): Promise<string> {
    const vaultDir = await this.getVaultDirectory(vaultName)
    const vaultSysDir = `${vaultDir}/.baishou`
    const info = await FileSystem.getInfoAsync(vaultSysDir)
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(vaultSysDir, { intermediates: true })
    }
    return vaultSysDir
  }

  public async getSnapshotsDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/snapshots`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    return dir
  }

  public async getJournalsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultDirectory(name)}/Journals`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    return dir
  }

  public async getSummariesBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultDirectory(name)}/Archives`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    return dir
  }

  public async getLegacyArchivesDirectory(): Promise<string | null> {
    const dir = await this.getSummariesBaseDirectory()
    try {
      const info = await FileSystem.getInfoAsync(dir)
      if (info.exists) return dir
    } catch {
      // ignore
    }
    return null
  }

  public async getSessionsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/sessions`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    return dir
  }

  public async getAssistantsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/assistants`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    return dir
  }

  public async getAttachmentsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultSystemDirectory(name)}/attachments`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
    return dir
  }

  public async getAvatarsDirectory(): Promise<string> {
    const att = await this.getAttachmentsBaseDirectory()
    const dir = `${att}/avatars`
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
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
    const info = await FileSystem.getInfoAsync(dir)
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true })
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
