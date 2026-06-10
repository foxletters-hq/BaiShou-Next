import * as Sharing from 'expo-sharing'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { zip, unzip } from 'react-native-zip-archive'

import {
  IArchiveService,
  ImportResult,
  VaultService,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { getAppCacheDirectory, getAppDocumentDirectory } from './mobile-app-paths'

export class MobileArchiveService implements IArchiveService {
  constructor(
    private pathService: IStoragePathService,
    private vaultService: VaultService,
    private readonly fileSystem: IFileSystem
  ) {}

  public async exportToTempFile(): Promise<string | null> {
    const rootDir = await this.pathService.getRootDirectory()
    const cacheDir = `${getAppCacheDirectory()}baishou_archive_prep_${Date.now()}`
    await this.fileSystem.mkdir(cacheDir, { recursive: true })

    if (await this.fileSystem.exists(rootDir)) {
      const rootStat = await this.fileSystem.stat(rootDir)
      if (rootStat.isDirectory) {
        await this.selectiveCopy(rootDir, cacheDir)
      }
    }

    try {
      const configDir = `${cacheDir}/config`
      await this.fileSystem.mkdir(configDir, { recursive: true })

      const prefs: Record<string, unknown> = {}
      const keys = await AsyncStorage.getAllKeys()
      for (const k of keys) {
        if (k.startsWith('@settings:')) {
          prefs[k] = await AsyncStorage.getItem(k)
        }
      }

      await this.fileSystem.writeFile(
        `${configDir}/device_preferences.json`,
        JSON.stringify(prefs, null, 2)
      )
    } catch (e) {
      console.warn('[MobileArchive] Failed to dump device preferences', e)
    }

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
    try {
      await this.fileSystem.rm(rootDir, { recursive: true, force: true })
    } catch (e) {
      console.warn('[MobileArchive] Wipe root warning', e)
    }
    await this.fileSystem.mkdir(rootDir, { recursive: true })

    try {
      const sourceZip = zipFilePath.replace('file://', '')
      const targetDir = rootDir.replace('file://', '')
      await unzip(sourceZip, targetDir)
    } catch (e) {
      console.error('[MobileArchive] Failed to extract physical payload', e)
      throw new Error('导入解压失败，请检查文件格式或存储权限')
    }

    try {
      const registryFile = `${rootDir}/.baishou/vault_registry.json`
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

    try {
      const configPath = `${rootDir}/config/device_preferences.json`
      if (await this.fileSystem.exists(configPath)) {
        const raw = await this.fileSystem.readFile(configPath)
        const prefs = JSON.parse(raw) as Record<string, string>

        for (const [k, v] of Object.entries(prefs)) {
          if (typeof v === 'string') {
            await AsyncStorage.setItem(k, v)
          }
        }
        await this.fileSystem.rm(`${rootDir}/config`, { recursive: true, force: true })
      }
    } catch (e) {
      console.warn('[MobileArchive] Failed to restore device preferences', e)
    }

    await this.vaultService.initRegistry()

    return {
      fileCount: -1,
      profileRestored: true,
      snapshotPath
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

  private async selectiveCopy(sourceDirPath: string, targetDirPath: string) {
    const dirContent = await this.fileSystem.readdir(sourceDirPath)

    for (const itemName of dirContent) {
      if (itemName === 'snapshots' || itemName === 'temp') continue
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
