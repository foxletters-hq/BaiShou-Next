import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { sanitizeVaultDirectoryName } from '@baishou/core-mobile'
import {
  readVaultExternalPaths,
  resolveJournalsBaseDirectory,
  resolveSummariesBaseDirectory
} from '@baishou/core-mobile'
import { getAppDocumentDirectory } from './mobile-app-paths'
import { joinStoragePath } from './mobile-storage-path.util'
import {
  resolveLegacySandboxSnapshotsDirectory,
  resolveMobileSnapshotsDirectory
} from './mobile-snapshot-path.util'
import {
  EXTERNAL_STORAGE_ROOT,
  ExternalStorageRequiredError,
  canWriteExternalStorage,
  hasStoragePermission,
  openAllFilesAccessSettings as openAllFilesAccessSettingsPage,
  requestStoragePermission
} from './storage-permission.service'
import {
  normalizeExternalStoragePath,
  normalizeStoragePath,
  requiresAllFilesAccessForPath
} from './android-external-fs'
import { ensureAndroidNoMediaMarker } from './android-nomedia.util'

export { EXTERNAL_STORAGE_ROOT }

/**
 * Android 默认数据根为 /storage/emulated/0/BaiShou_Root（EXTERNAL_STORAGE_ROOT）。
 * 用户可在设置中更换目录；自定义路径保存在 AsyncStorage，不得被默认根覆盖。
 */
export class MobileStoragePathService implements IStoragePathService {
  constructor(private readonly fileSystem: IFileSystem) {}

  private customRootKey = 'baishou_custom_storage_root'

  public async getCustomRootPath(): Promise<string | null> {
    try {
      const stored = await AsyncStorage.getItem(this.customRootKey)
      if (!stored) return null
      let normalized = normalizeStoragePath(stored)
      if (normalized.includes('/emulated/0') && !normalized.includes('/storage/emulated/0')) {
        normalized = normalized.replace('/emulated/0', '/storage/emulated/0')
      }
      if (stored !== normalized) {
        await AsyncStorage.setItem(this.customRootKey, normalized)
      }
      return normalized
    } catch {
      return null
    }
  }

  public async updateRootDirectory(newPath: string): Promise<void> {
    const normalized = normalizeStoragePath(normalizeExternalStoragePath(newPath))
    await AsyncStorage.setItem(this.customRootKey, normalized)
  }

  /**
   * 首次获得全文件访问权限时写入默认外部 BaiShou_Root。
   * 若用户已在设置/引导页选定目录，不得覆盖。
   */
  public async applyExternalRootWhenPermitted(): Promise<boolean> {
    if (Platform.OS !== 'android') return false

    const existing = await this.getCustomRootPath()
    if (existing?.trim()) {
      if (requiresAllFilesAccessForPath(existing) && !(await hasStoragePermission())) {
        return false
      }
      try {
        await this.ensureWritableDirectory(existing)
        return true
      } catch (e) {
        console.warn(`StoragePathService: Saved custom path ${existing} inaccessible.`, e)
        await AsyncStorage.removeItem(this.customRootKey)
      }
    }

    if (!(await hasStoragePermission())) return false
    if (!(await canWriteExternalStorage())) {
      console.warn('StoragePathService: All-files access granted but external probe write failed.')
    }

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

  private async ensureDir(dir: string): Promise<void> {
    if (!(await this.fileSystem.exists(dir))) {
      await this.fileSystem.mkdir(dir, { recursive: true })
    }
  }

  /** Android：Attachments 等应用数据目录不应被系统相册索引 */
  private async ensureDirHiddenFromGallery(dir: string): Promise<void> {
    await this.ensureDir(dir)
    if (Platform.OS === 'android') {
      await ensureAndroidNoMediaMarker(dir, this.fileSystem)
    }
  }

  private async ensureWritableDirectory(dirUri: string): Promise<string> {
    const dir = normalizeStoragePath(dirUri)
    await this.ensureDir(dir)
    const testFile = `${dir}/.write_test`
    await this.fileSystem.writeFile(testFile, 'test')
    try {
      await this.fileSystem.unlink(testFile)
    } catch {
      // ignore cleanup errors
    }
    return dir
  }

  private async getSandboxRootDirectory(): Promise<string> {
    const base = getAppDocumentDirectory()
    const internalFallback = `${base}Vaults`
    return this.ensureWritableDirectory(internalFallback)
  }

  public async getRootDirectory(): Promise<string> {
    if (Platform.OS === 'android') {
      const customPath = await this.getCustomRootPath()
      if (customPath?.trim()) {
        if (requiresAllFilesAccessForPath(customPath) && !(await hasStoragePermission())) {
          throw new ExternalStorageRequiredError()
        }
        try {
          return await this.ensureWritableDirectory(customPath)
        } catch (e) {
          console.warn(`StoragePathService: Custom path ${customPath} inaccessible.`, e)
          await AsyncStorage.removeItem(this.customRootKey)
        }
      }

      if (!(await hasStoragePermission())) {
        throw new ExternalStorageRequiredError()
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
    const safeName = sanitizeVaultDirectoryName(vaultName)
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

  public async getActiveVaultSettingsDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    return this.getVaultSystemDirectory(name)
  }

  /**
   * 全局 Shadow DB 目录（应用沙盒内单库，所有 Vault 共用 shadow_index_v2.db）
   */
  public async getGlobalShadowIndexDirectory(): Promise<string> {
    const base = await this.getGlobalRegistryDirectory()
    const dir = `${base}/shadow_index`
    await this.ensureDir(dir)
    return dir
  }

  public async getSnapshotsDirectory(): Promise<string> {
    const root = normalizeStoragePath(await this.getRootDirectory())
    const dir = resolveMobileSnapshotsDirectory(root)
    await this.ensureDir(dir)
    await this.migrateSnapshotsFromDirectory(
      resolveLegacySandboxSnapshotsDirectory(getAppDocumentDirectory()),
      dir
    )
    await this.migrateSnapshotsFromDirectory(joinStoragePath(root, '.snapshots'), dir)
    return dir
  }

  private async migrateSnapshotsFromDirectory(sourceDir: string, targetDir: string): Promise<void> {
    try {
      const normalizedSource = normalizeStoragePath(sourceDir)
      const normalizedTarget = normalizeStoragePath(targetDir)
      if (
        normalizedSource === normalizedTarget ||
        !(await this.fileSystem.exists(normalizedSource))
      ) {
        return
      }

      const files = await this.fileSystem.readdir(normalizedSource)
      for (const name of files) {
        if (!name || !name.startsWith('snapshot_') || !name.endsWith('.zip')) continue
        const src = joinStoragePath(normalizedSource, name)
        const dest = joinStoragePath(normalizedTarget, name)
        if (await this.fileSystem.exists(dest)) continue
        try {
          await this.fileSystem.copyFile(src, dest)
          await this.fileSystem.unlink(src).catch(() => {})
        } catch (e) {
          console.warn('[StoragePath] Failed to migrate snapshot', name, e)
        }
      }

      const remaining = await this.fileSystem.readdir(normalizedSource).catch(() => [] as string[])
      if (remaining.length === 0) {
        await this.fileSystem.rm(normalizedSource, { recursive: true, force: true }).catch(() => {})
      }
    } catch (e) {
      console.warn('[StoragePath] Snapshot migration skipped', sourceDir, e)
    }
  }

  public async getJournalsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const vaultDir = await this.getVaultDirectory(name)
    const sysDir = await this.getVaultSystemDirectory(name)
    const external = await readVaultExternalPaths(this.fileSystem, sysDir)
    const resolved = resolveJournalsBaseDirectory(vaultDir, external)
    if (external.journalsDirectory?.trim() && (await this.fileSystem.exists(resolved))) {
      return resolved
    }
    const internal = joinStoragePath(vaultDir, 'Journals')
    await this.ensureDir(internal)
    return internal
  }

  public async getSummariesBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const vaultDir = await this.getVaultDirectory(name)
    const sysDir = await this.getVaultSystemDirectory(name)
    const external = await readVaultExternalPaths(this.fileSystem, sysDir)
    const resolved = resolveSummariesBaseDirectory(vaultDir, external)
    if (external.summariesDirectory?.trim() && (await this.fileSystem.exists(resolved))) {
      return resolved
    }
    const internal = joinStoragePath(vaultDir, 'Archives')
    await this.ensureDir(internal)
    return internal
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
    const dir = `${await this.getVaultDirectory(name)}/Sessions`
    await this.ensureDir(dir)
    return dir
  }

  public async getAssistantsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultDirectory(name)}/Assistants`
    await this.ensureDir(dir)
    return dir
  }

  public async getAttachmentsBaseDirectory(): Promise<string> {
    const name = await this.getActiveVaultName()
    const dir = `${await this.getVaultDirectory(name)}/Attachments`
    await this.ensureDirHiddenFromGallery(dir)
    return dir
  }

  public async getAvatarsDirectory(): Promise<string> {
    const att = await this.getAttachmentsBaseDirectory()
    const dir = `${att}/avatars`
    await this.ensureDirHiddenFromGallery(dir)
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

  public async getUserAvatarsDirectory(): Promise<string> {
    const root = await this.getAvatarsDirectory()
    const dir = `${root}/UserAvatars`
    await this.ensureDirHiddenFromGallery(dir)
    return dir
  }

  public async getChatBackgroundsDirectory(): Promise<string> {
    const att = await this.getAttachmentsBaseDirectory()
    const dir = `${att}/backgrounds`
    await this.ensureDirHiddenFromGallery(dir)
    return dir
  }
}
