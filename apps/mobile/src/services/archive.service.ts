import * as Sharing from 'expo-sharing'
import { zip, unzip } from 'react-native-zip-archive'

import {
  IArchiveService,
  ImportResult,
  VaultService,
  copyStorageRootContents,
  isLegacyAppRoot,
  resolveAgentDbPath,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { getAppCacheDirectory, getAppDocumentDirectory } from './mobile-app-paths'
import {
  FULL_BACKUP_EXCLUDED_ROOT_NAMES,
  resetIncrementalSyncMetaAfterFullRestore
} from '@baishou/shared'
import {
  ARCHIVE_USER_AVATARS_ZIP_PREFIX,
  MOBILE_ARCHIVE_DB_ZIP_NAME,
  type MobileArchiveDbBridge
} from './mobile-archive-db.bridge'

const ARCHIVE_SKIP_TOP_LEVEL = new Set(['database', 'config', 'manifest.json', 'user-data'])

export class MobileArchiveService implements IArchiveService {
  constructor(
    private pathService: IStoragePathService,
    private vaultService: VaultService,
    private readonly fileSystem: IFileSystem,
    private readonly dbBridge?: MobileArchiveDbBridge
  ) {}

  public async exportToTempFile(): Promise<string | null> {
    if (this.dbBridge) {
      await this.dbBridge.flushBeforeExport()
    }

    const rootDir = await this.pathService.getRootDirectory()
    const cacheDir = `${getAppCacheDirectory()}baishou_archive_prep_${Date.now()}`
    await this.fileSystem.mkdir(cacheDir, { recursive: true })

    if (await this.fileSystem.exists(rootDir)) {
      const rootStat = await this.fileSystem.stat(rootDir)
      if (rootStat.isDirectory) {
        await this.copyStorageRootForArchive(rootDir, cacheDir)
      }
    }

    try {
      const configDir = `${cacheDir}/config`
      await this.fileSystem.mkdir(configDir, { recursive: true })

      const prefs = this.dbBridge
        ? await this.dbBridge.exportDevicePreferences()
        : await this.legacyExportAsyncStoragePrefs()

      await this.fileSystem.writeFile(
        `${configDir}/device_preferences.json`,
        JSON.stringify(prefs, null, 2)
      )
    } catch (e) {
      console.warn('[MobileArchive] Failed to dump device preferences', e)
    }

    if (this.dbBridge) {
      try {
        const dbUri = await this.dbBridge.getAgentDatabaseUri()
        if (dbUri && (await this.fileSystem.exists(dbUri))) {
          const dbDir = `${cacheDir}/database`
          await this.fileSystem.mkdir(dbDir, { recursive: true })
          await this.fileSystem.copyFile(dbUri, `${dbDir}/baishou_agent.db`)
        }
      } catch (e) {
        console.warn('[MobileArchive] Failed to pack agent database', e)
      }
    }

    const manifest = {
      formatVersion: 1,
      exportedAt: Date.now(),
      platform: 'mobile'
    }
    await this.fileSystem.writeFile(`${cacheDir}/manifest.json`, JSON.stringify(manifest, null, 2))

    const targetZip = `${getAppCacheDirectory()}BaiShou_Backup_${Date.now()}.zip`
    try {
      await zip(cacheDir.replace('file://', ''), targetZip.replace('file://', ''))
      await this.fileSystem.rm(cacheDir, { recursive: true, force: true })
      return targetZip
    } catch (err) {
      console.error('[MobileArchive] ZIP operation failed', err)
      return null
    }
  }

  public async exportToUserDevice(): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) return null

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: '保存 BaiShou 物理系统备份'
      })
      return zipPath
    }
    return null
  }

  public async importFromZip(
    zipFilePath: string,
    createSnapshotBefore: boolean = true
  ): Promise<ImportResult> {
    let snapshotPath: string | undefined

    if (createSnapshotBefore) {
      const snap = await this.createSnapshot()
      if (snap) snapshotPath = snap
    }

    const rootDir = await this.pathService.getRootDirectory()
    const extractDir = `${getAppCacheDirectory()}baishou_archive_extract_${Date.now()}`
    await this.fileSystem.mkdir(extractDir, { recursive: true })

    try {
      const sourceZip = zipFilePath.replace('file://', '')
      const targetDir = extractDir.replace('file://', '')
      await unzip(sourceZip, targetDir)
    } catch (e) {
      console.error('[MobileArchive] Failed to extract archive', e)
      throw new Error('导入解压失败，请检查文件格式或存储权限')
    }

    let needsRestart = false
    const preservedSettings = this.dbBridge ? await this.dbBridge.readPreservedImportSettings() : {}

    const hasManifest = await this.fileSystem.exists(`${extractDir}/manifest.json`)
    const isFlutterLegacyZip =
      !hasManifest && (await isLegacyAppRoot(this.fileSystem, extractDir))

    if (isFlutterLegacyZip) {
      if (!this.dbBridge?.importLegacyFlutterZip) {
        throw new Error('当前环境不支持导入 Flutter 旧版备份包')
      }

      const stagingDir = `${getAppCacheDirectory()}baishou_legacy_staging_${Date.now()}`
      await this.fileSystem.mkdir(stagingDir, { recursive: true })

      try {
        await this.dbBridge.importLegacyFlutterZip(extractDir, stagingDir)

        try {
          await this.fileSystem.rm(rootDir, { recursive: true, force: true })
        } catch (e) {
          console.warn('[MobileArchive] Wipe root warning (legacy zip)', e)
        }
        await this.fileSystem.mkdir(rootDir, { recursive: true })
        await copyStorageRootContents(this.fileSystem, stagingDir, rootDir)

        const stagedAgentDb = resolveAgentDbPath(rootDir)
        if (this.dbBridge && (await this.fileSystem.exists(stagedAgentDb))) {
          needsRestart = await this.dbBridge.replaceAgentDatabaseFrom(stagedAgentDb)
        }

        try {
          const syncMetaDir = `${rootDir}/.baishou`
          await resetIncrementalSyncMetaAfterFullRestore(syncMetaDir, {
            exists: (p) => this.fileSystem.exists(p),
            read: (p) => this.fileSystem.readFile(p),
            write: (p, content) => this.fileSystem.writeFile(p, content),
            unlink: (p) => this.fileSystem.unlink(p)
          })
        } catch (e) {
          console.warn('[MobileArchive] Failed to reset incremental sync meta (legacy zip)', e)
        }

        await this.vaultService.initRegistry()
      } finally {
        await this.fileSystem.rm(stagingDir, { recursive: true, force: true }).catch(() => {})
        await this.fileSystem.rm(extractDir, { recursive: true, force: true }).catch(() => {})
      }

      return {
        fileCount: -1,
        profileRestored: true,
        snapshotPath,
        needsRestart
      }
    }

    try {
      try {
        await this.fileSystem.rm(rootDir, { recursive: true, force: true })
      } catch (e) {
        console.warn('[MobileArchive] Wipe root warning', e)
      }
      await this.fileSystem.mkdir(rootDir, { recursive: true })

      const entries = await this.fileSystem.readdir(extractDir)
      for (const name of entries) {
        if (ARCHIVE_SKIP_TOP_LEVEL.has(name)) continue
        const src = `${extractDir}/${name}`
        const dest = `${rootDir}/${name}`
        const stat = await this.fileSystem.stat(src)
        if (stat.isDirectory) {
          await this.fileSystem.mkdir(dest, { recursive: true })
          await this.selectiveCopy(src, dest)
        } else if (stat.isFile) {
          await this.fileSystem.copyFile(src, dest)
        }
      }

      await this.restoreUserAvatarsFromExtract(extractDir)

      const dbPath = `${extractDir}/${MOBILE_ARCHIVE_DB_ZIP_NAME}`
      if (this.dbBridge && (await this.fileSystem.exists(dbPath))) {
        needsRestart = await this.dbBridge.replaceAgentDatabaseFrom(dbPath)
      }

      const configPath = `${extractDir}/config/device_preferences.json`
      if (await this.fileSystem.exists(configPath)) {
        const raw = await this.fileSystem.readFile(configPath)
        const prefs = JSON.parse(raw) as Record<string, unknown>
        if (preservedSettings.cloud_sync_config !== undefined) {
          prefs.cloud_sync_config = preservedSettings.cloud_sync_config
        }
        if (this.dbBridge) {
          await this.dbBridge.importDevicePreferences(prefs)
        } else {
          await this.legacyImportAsyncStoragePrefs(prefs as Record<string, string>)
        }
      }

      try {
        const syncMetaDir = `${rootDir}/.baishou`
        await resetIncrementalSyncMetaAfterFullRestore(syncMetaDir, {
          exists: (p) => this.fileSystem.exists(p),
          read: (p) => this.fileSystem.readFile(p),
          write: (p, content) => this.fileSystem.writeFile(p, content),
          unlink: (p) => this.fileSystem.unlink(p)
        })
      } catch (e) {
        console.warn('[MobileArchive] Failed to reset incremental sync meta', e)
      }

      try {
        const registryFile = `${rootDir}/vault_registry.json`
        if (await this.fileSystem.exists(registryFile)) {
          const raw = await this.fileSystem.readFile(registryFile)
          const vaults: Array<{ name: string; path: string }> = JSON.parse(raw)
          let modified = false

          for (const v of vaults) {
            const correctPath = `${rootDir}/${v.name}`
            if (v.path !== correctPath) {
              v.path = correctPath
              modified = true
            }
          }
          if (modified) {
            await this.fileSystem.writeFile(registryFile, JSON.stringify(vaults, null, 2))
          }
        }
      } catch (e) {
        console.warn('[MobileArchive] Failed to remap vault paths', e)
      }

      await this.vaultService.initRegistry()
    } finally {
      await this.fileSystem.rm(extractDir, { recursive: true, force: true }).catch(() => {})
    }

    return {
      fileCount: -1,
      profileRestored: true,
      snapshotPath,
      needsRestart
    }
  }

  private async legacyExportAsyncStoragePrefs(): Promise<Record<string, unknown>> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    const prefs: Record<string, unknown> = {}
    const keys = await AsyncStorage.getAllKeys()
    for (const k of keys) {
      if (k.startsWith('@settings:')) {
        prefs[k] = await AsyncStorage.getItem(k)
      }
    }
    return prefs
  }

  private async legacyImportAsyncStoragePrefs(prefs: Record<string, string>): Promise<void> {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
    for (const [k, v] of Object.entries(prefs)) {
      if (typeof v === 'string') {
        await AsyncStorage.setItem(k, v)
      }
    }
  }

  private getSnapshotDir(): string {
    return `${getAppDocumentDirectory()}snapshots`
  }

  public async createSnapshot(): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) return null

    const snapshotDir = this.getSnapshotDir()
    await this.fileSystem.mkdir(snapshotDir, { recursive: true })

    const dt = new Date()
    const ts = `${dt.getFullYear()}${(dt.getMonth() + 1).toString().padStart(2, '0')}${dt.getDate().toString().padStart(2, '0')}_${dt.getHours().toString().padStart(2, '0')}${dt.getMinutes().toString().padStart(2, '0')}`
    const finalSnapPath = `${snapshotDir}/snapshot_${ts}.zip`

    await this.fileSystem.copyFile(zipPath, finalSnapPath)
    await this.fileSystem.unlink(zipPath)
    await this.pruneSnapshots(5)
    return finalSnapPath
  }

  public async listSnapshots(): Promise<import('@baishou/core-mobile').SnapshotMeta[]> {
    const snapshotDir = this.getSnapshotDir()
    if (!(await this.fileSystem.exists(snapshotDir))) return []

    const files = await this.fileSystem.readdir(snapshotDir)
    const results: import('@baishou/core-mobile').SnapshotMeta[] = []
    for (const filename of files) {
      if (!filename.endsWith('.zip') || !filename.startsWith('snapshot_')) continue
      const fullPath = `${snapshotDir}/${filename}`
      try {
        const stat = await this.fileSystem.stat(fullPath)
        if (!stat.isFile) continue
        results.push({
          filename,
          createdAt: stat.mtimeMs ?? Date.now(),
          size: stat.size ?? 0
        })
      } catch {
        // skip
      }
    }
    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  public async restoreFromSnapshot(filename: string): Promise<ImportResult> {
    const fullPath = `${this.getSnapshotDir()}/${filename}`
    if (!(await this.fileSystem.exists(fullPath))) {
      throw new Error('Snapshot not found')
    }
    return this.importFromZip(fullPath, true)
  }

  public async deleteSnapshot(filename: string): Promise<void> {
    const fullPath = `${this.getSnapshotDir()}/${filename}`
    await this.fileSystem.unlink(fullPath)
  }

  private async pruneSnapshots(maxCount: number): Promise<void> {
    if (maxCount < 0) return
    const list = await this.listSnapshots()
    if (list.length <= maxCount) return
    const toDelete = list.slice(maxCount)
    for (const item of toDelete) {
      await this.deleteSnapshot(item.filename).catch(() => {})
    }
  }

  private async copyStorageRootForArchive(sourceRoot: string, targetRoot: string): Promise<void> {
    const entries = await this.fileSystem.readdir(sourceRoot)
    for (const itemName of entries) {
      if (FULL_BACKUP_EXCLUDED_ROOT_NAMES.has(itemName)) continue
      if (itemName === 'snapshots' || itemName === 'temp' || itemName === '.snapshots') continue

      const fullSourcePath = `${sourceRoot}/${itemName}`
      const fullTargetPath = `${targetRoot}/${itemName}`
      const stat = await this.fileSystem.stat(fullSourcePath)
      if (stat.isDirectory) {
        await this.fileSystem.mkdir(fullTargetPath, { recursive: true })
        await this.selectiveCopy(fullSourcePath, fullTargetPath)
      } else if (
        !itemName.endsWith('-wal') &&
        !itemName.endsWith('-shm') &&
        !itemName.endsWith('-journal')
      ) {
        await this.fileSystem.copyFile(fullSourcePath, fullTargetPath)
      }
    }
  }

  private async restoreUserAvatarsFromExtract(extractDir: string): Promise<void> {
    const avatarsSrc = `${extractDir}/${ARCHIVE_USER_AVATARS_ZIP_PREFIX}`
    if (!(await this.fileSystem.exists(avatarsSrc))) return

    const avatarsDest = await this.pathService.getUserAvatarsDirectory()
    await this.fileSystem.rm(avatarsDest, { recursive: true, force: true }).catch(() => {})
    await this.fileSystem.mkdir(avatarsDest, { recursive: true })

    const copyDir = async (src: string, dest: string) => {
      const entries = await this.fileSystem.readdir(src)
      for (const name of entries) {
        const srcPath = `${src}/${name}`
        const destPath = `${dest}/${name}`
        const stat = await this.fileSystem.stat(srcPath)
        if (stat.isDirectory) {
          await this.fileSystem.mkdir(destPath, { recursive: true })
          await copyDir(srcPath, destPath)
        } else {
          await this.fileSystem.copyFile(srcPath, destPath)
        }
      }
    }

    await copyDir(avatarsSrc, avatarsDest)
  }

  private async selectiveCopy(sourceDirPath: string, targetDirPath: string) {
    const dirContent = await this.fileSystem.readdir(sourceDirPath)

    for (const itemName of dirContent) {
      if (itemName === 'snapshots' || itemName === 'temp' || itemName === '.snapshots') continue
      if (itemName.endsWith('-wal') || itemName.endsWith('-shm') || itemName.endsWith('-journal'))
        continue

      const fullSourcePath = `${sourceDirPath}/${itemName}`
      const fullTargetPath = `${targetDirPath}/${itemName}`

      const stat = await this.fileSystem.stat(fullSourcePath)
      if (stat.isDirectory) {
        await this.fileSystem.mkdir(fullTargetPath, { recursive: true })
        await this.selectiveCopy(fullSourcePath, fullTargetPath)
      } else {
        await this.fileSystem.copyFile(fullSourcePath, fullTargetPath)
      }
    }
  }
}
