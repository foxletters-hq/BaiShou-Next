import { Platform } from 'react-native'
import { zip, unzip } from 'react-native-zip-archive'
import {
  isNativeArchiveImportAvailable,
  isNativeArchiveExportAvailable,
  nativeCopyArchiveExtractToRoot,
  nativeUnzipArchive,
  nativeZipArchiveExport
} from 'expo-baishou-server'

import {
  IArchiveService,
  ImportResult,
  VaultService,
  shouldImportArchiveAsFlutterLegacy,
  purgeImportedShadowIndexCaches,
  resolveAgentDbPath,
  resolveArchivePayloadRoot,
  mergeArchivePrefsPreservingCloudSync,
  discoverVaultNames,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { normalizeStoragePath, stripFileScheme } from './android-external-fs'
import { getAppCacheDirectory } from './mobile-app-paths'
import { joinStoragePath } from './mobile-storage-path.util'
import { importUriToPath, normalizeImportSourceUri } from './mobile-uri-import'
import { shareLocalFile } from '../utils/share-local-file.util'
import {
  FULL_BACKUP_EXCLUDED_ROOT_NAMES,
  resetIncrementalSyncMetaAfterFullRestore
} from '@baishou/shared'
import {
  ARCHIVE_USER_AVATARS_ZIP_PREFIX,
  MOBILE_ARCHIVE_DB_ZIP_NAME,
  type MobileArchiveDbBridge
} from './mobile-archive-db.bridge'
import {
  assertSafeSnapshotFilename,
  ARCHIVE_SKIP_TOP_LEVEL,
  collectSnapshotPreserveKeys,
  formatArchiveImportFailureMessage,
  isValidArchiveManifestContent,
  LARGE_ARCHIVE_IMPORT_BYTES,
  resolveSnapshotCreatedAt,
  SNAPSHOT_STORAGE_DIR_NAMES,
  validateArchiveExtractPayload,
  estimateLegacyFlutterZipCopyFiles,
  formatArchiveImportEntryDetail,
  reportArchiveImportStage,
  type ArchiveImportProgressCallback
} from './archive-guards.util'
import type { ArchiveRestoreRebootstrapOptions } from './mobile-archive-db.bridge'

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

    const rootDir = normalizeStoragePath(await this.pathService.getRootDirectory())
    const stagingDir = this.getArchiveExportStagingDir(rootDir)
    await this.fileSystem.mkdir(stagingDir, { recursive: true })

    const supplementDir = joinStoragePath(stagingDir, `supplement_${Date.now()}`)
    await this.fileSystem.mkdir(supplementDir, { recursive: true })

    try {
      await this.buildArchiveSupplement(supplementDir)

      const targetZip = joinStoragePath(stagingDir, `BaiShou_Backup_${Date.now()}.zip`)

      if (Platform.OS === 'android') {
        if (!isNativeArchiveExportAvailable()) {
          throw new Error(
            '全量备份需要新版原生导出模块。请执行 pnpm dev:mobile:clear 重新安装开发版（不可用 Expo Go）。'
          )
        }

        const result = await nativeZipArchiveExport(rootDir, supplementDir, targetZip)
        await this.fileSystem.rm(supplementDir, { recursive: true, force: true }).catch(() => {})

        if (result.entryCount <= 0) {
          await this.fileSystem.unlink(targetZip).catch(() => {})
          throw new Error('打包备份失败：未找到可导出的数据文件')
        }

        return targetZip
      }

      await this.exportToTempFileDirectZip(rootDir, supplementDir, targetZip)
      await this.fileSystem.rm(supplementDir, { recursive: true, force: true }).catch(() => {})
      return targetZip
    } catch (err) {
      await this.fileSystem.rm(supplementDir, { recursive: true, force: true }).catch(() => {})
      throw err
    }
  }

  private getArchiveExportStagingDir(rootDir: string): string {
    return joinStoragePath(rootDir, '.baishou/export_staging')
  }

  /**
   * 非 Android：直接从数据根目录挑选顶层条目打包，避免整库复制进应用沙盒。
   */
  private async exportToTempFileDirectZip(
    rootDir: string,
    supplementDir: string,
    targetZip: string
  ): Promise<void> {
    const zipSources: string[] = []

    try {
      const rootStat = await this.fileSystem.stat(rootDir)
      if (rootStat.isDirectory) {
        const entries = await this.fileSystem.readdir(rootDir)
        for (const itemName of entries) {
          if (!itemName || itemName === '.' || itemName === '..') continue
          if (FULL_BACKUP_EXCLUDED_ROOT_NAMES.has(itemName)) continue
          if (SNAPSHOT_STORAGE_DIR_NAMES.has(itemName)) {
            continue
          }
          zipSources.push(joinStoragePath(rootDir, itemName))
        }
      }
    } catch (e) {
      console.warn('[MobileArchive] Skip reading storage root for direct zip export', e)
    }

    zipSources.push(supplementDir)

    if (zipSources.length === 0) {
      throw new Error('打包备份失败：未找到可导出的数据文件')
    }

    try {
      await zip(
        zipSources.map((p) => stripFileScheme(p)),
        stripFileScheme(targetZip)
      )
    } catch (err) {
      console.error('[MobileArchive] Direct ZIP operation failed', err)
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`打包备份失败：${message}`)
    }
  }

  private async buildArchiveSupplement(cacheDir: string): Promise<void> {
    try {
      await this.packUserAvatarsForArchive(cacheDir)
    } catch (e) {
      console.warn('[MobileArchive] Failed to pack user avatars', e)
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
      const dbUri = await this.dbBridge.getAgentDatabaseUri()
      if (dbUri && (await this.fileSystem.exists(dbUri))) {
        const dbDir = `${cacheDir}/database`
        await this.fileSystem.mkdir(dbDir, { recursive: true })
        try {
          await this.fileSystem.copyFile(dbUri, `${dbDir}/baishou_agent.db`)
        } catch (e) {
          const detail = e instanceof Error ? e.message : String(e)
          throw new Error(`打包数据库失败：${detail}`)
        }
      }
    }

    const manifest = {
      formatVersion: 1,
      exportedAt: Date.now(),
      platform: 'mobile'
    }
    await this.fileSystem.writeFile(`${cacheDir}/manifest.json`, JSON.stringify(manifest, null, 2))
  }

  public async exportToUserDevice(): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) {
      throw new Error('生成备份 ZIP 失败')
    }

    try {
      await shareLocalFile(this.fileSystem, zipPath, {
        mimeType: 'application/zip',
        dialogTitle: '保存 BaiShou 物理系统备份',
        UTI: 'public.zip-archive'
      })
    } finally {
      await this.fileSystem.unlink(zipPath).catch(() => {})
    }
    return null
  }

  public async importFromZip(
    zipFilePath: string,
    createSnapshotBefore: boolean = true,
    onProgress?: ArchiveImportProgressCallback
  ): Promise<ImportResult> {
    const runQuiesced =
      this.dbBridge?.runArchiveImportQuiesced ?? ((fn: () => Promise<ImportResult>) => fn())
    return runQuiesced(() =>
      this.importFromZipInternal(zipFilePath, createSnapshotBefore, onProgress)
    )
  }

  private async importFromZipInternal(
    zipFilePath: string,
    createSnapshotBefore: boolean,
    onProgress?: ArchiveImportProgressCallback
  ): Promise<ImportResult> {
    let snapshotPath: string | undefined

    const rootDir = normalizeStoragePath(await this.pathService.getRootDirectory())
    await this.fileSystem.mkdir(rootDir, { recursive: true })

    const preserveDuringSnapshot = normalizeStoragePath(zipFilePath)
    const skipPreImportSnapshot = await this.shouldSkipPreImportSnapshot(zipFilePath)

    reportArchiveImportStage(onProgress, 'preparing')
    if (createSnapshotBefore && !skipPreImportSnapshot && (await this.storageRootHasData(rootDir))) {
      try {
        reportArchiveImportStage(onProgress, 'snapshot')
        const snap = await this.createSnapshot({ preservePaths: [preserveDuringSnapshot] })
        if (!snap) {
          throw new Error('导入前创建保护快照失败，已中止导入以保护当前数据')
        }
        snapshotPath = snap
      } catch (e) {
        console.error('[MobileArchive] Pre-import snapshot failed', e)
        const detail = e instanceof Error ? e.message : String(e)
        throw new Error(
          detail.includes('保护快照') ? detail : `导入前创建保护快照失败，已中止导入（${detail}）`
        )
      }
    }

    let extractDir: string | undefined
    try {
      extractDir = joinStoragePath(
        stripFileScheme(getAppCacheDirectory()),
        `baishou_archive_extract_${Date.now()}`
      )
      await this.fileSystem.mkdir(extractDir, { recursive: true })

      reportArchiveImportStage(onProgress, 'unpacking')
      const { nativeZipPath, cleanupStagedZip } = await this.stageZipForUnzip(zipFilePath)
      const useNativeArchiveImport = Platform.OS === 'android' && isNativeArchiveImportAvailable()
      try {
        if (useNativeArchiveImport) {
          await nativeUnzipArchive(nativeZipPath, extractDir, ({ current, total, detail }) => {
            reportArchiveImportStage(onProgress, 'unpacking', {
              detail: formatArchiveImportEntryDetail(detail),
              subCurrent: current,
              subTotal: total
            })
          })
        } else {
          await unzip(nativeZipPath, extractDir)
        }
      } catch (e) {
        console.error('[MobileArchive] Failed to extract archive', e)
        const detail = e instanceof Error ? e.message : String(e)
        throw new Error(`导入解压失败，请检查文件格式或存储权限（${detail}）`)
      } finally {
        await cleanupStagedZip?.()
      }

      const payloadDir = await resolveArchivePayloadRoot(this.fileSystem, extractDir)

      reportArchiveImportStage(onProgress, 'validating')
      const preservedSettings = this.dbBridge
        ? await this.dbBridge.readPreservedImportSettings()
        : {}

      const hasValidManifest = await this.resolveHasValidManifest(payloadDir)
      const isFlutterLegacyZip = await shouldImportArchiveAsFlutterLegacy(
        this.fileSystem,
        payloadDir,
        hasValidManifest
      )
      await this.validateExtractedArchive(payloadDir, isFlutterLegacyZip)

      if (isFlutterLegacyZip) {
        if (!this.dbBridge?.importLegacyFlutterZip) {
          throw new Error('当前环境不支持导入 Flutter 旧版备份包')
        }

        try {
          const vaultNames = await discoverVaultNames(this.fileSystem, payloadDir)
          const copyTotal = await estimateLegacyFlutterZipCopyFiles(
            this.fileSystem,
            payloadDir,
            vaultNames
          )
          let copyCurrent = 0
          reportArchiveImportStage(onProgress, 'migrating_legacy', {
            detail: '正在准备工作区…',
            subCurrent: 0,
            subTotal: copyTotal
          })
          try {
            await this.wipeStorageRootPreservingSnapshots(rootDir)
          } catch (e) {
            console.warn('[MobileArchive] Wipe root warning (legacy zip)', e)
          }
          await this.fileSystem.mkdir(rootDir, { recursive: true })

          // 直接迁移到最终工作区，避免 extract → staging → root 的第二次全量复制
          await this.dbBridge.importLegacyFlutterZip(payloadDir, rootDir, {
            onCopyProgress: (entryPath) => {
              copyCurrent += 1
              reportArchiveImportStage(onProgress, 'migrating_legacy', {
                detail: formatArchiveImportEntryDetail(entryPath),
                subCurrent: copyCurrent,
                subTotal: copyTotal
              })
            }
          })

          reportArchiveImportStage(onProgress, 'loading_database')
          const stagedAgentDb = resolveAgentDbPath(rootDir)
          if (this.dbBridge && (await this.fileSystem.exists(stagedAgentDb))) {
            await this.dbBridge.replaceAgentDatabaseFrom(stagedAgentDb)
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
          const globalShadowDir = await this.pathService.getGlobalShadowIndexDirectory()
          await purgeImportedShadowIndexCaches(this.fileSystem, {
            workspaceRoot: rootDir,
            globalShadowDir
          })

          reportArchiveImportStage(onProgress, 'rebuilding_index')
          const rebootstrapOptions: ArchiveRestoreRebootstrapOptions = {
            blockingResync: false,
            deferSummaryScan: true
          }
          if (this.dbBridge?.rebootstrapAfterArchiveRestore) {
            await this.dbBridge.rebootstrapAfterArchiveRestore(rebootstrapOptions)
          }

          const legacyConfigPath = joinStoragePath(payloadDir, 'config/device_preferences.json')
          if (
            (await this.fileSystem.exists(legacyConfigPath)) &&
            this.dbBridge?.importDevicePreferences
          ) {
            const raw = await this.fileSystem.readFile(legacyConfigPath)
            const prefs = mergeArchivePrefsPreservingCloudSync(
              JSON.parse(raw) as Record<string, unknown>,
              preservedSettings.cloud_sync_config
            )
            await this.dbBridge.importDevicePreferences(prefs)
          }
          reportArchiveImportStage(onProgress, 'finishing')
        } catch (restoreError) {
          throw new Error(formatArchiveImportFailureMessage(restoreError, snapshotPath))
        }

        return {
          fileCount: -1,
          profileRestored: true,
          snapshotPath
        }
      }

      try {
        reportArchiveImportStage(onProgress, 'restoring_files')
        try {
          await this.wipeStorageRootPreservingSnapshots(rootDir)
        } catch (e) {
          console.warn('[MobileArchive] Wipe root warning', e)
        }
        await this.fileSystem.mkdir(rootDir, { recursive: true })

        if (useNativeArchiveImport) {
          await nativeCopyArchiveExtractToRoot(payloadDir, rootDir)
        } else {
          const entries = await this.fileSystem.readdir(payloadDir)
          for (const name of entries) {
            if (!name || name === '.' || name === '..') continue
            if (ARCHIVE_SKIP_TOP_LEVEL.has(name)) continue
            const src = joinStoragePath(payloadDir, name)
            const dest = joinStoragePath(rootDir, name)
            const stat = await this.fileSystem.stat(src)
            if (stat.isDirectory) {
              await this.fileSystem.mkdir(dest, { recursive: true })
              await this.selectiveCopy(src, dest)
            } else if (stat.isFile) {
              await this.fileSystem.copyFile(src, dest)
            }
          }
        }

        await this.restoreUserAvatarsFromExtract(payloadDir)

        const dbPath = joinStoragePath(payloadDir, MOBILE_ARCHIVE_DB_ZIP_NAME)
        const restoredDatabase = !!this.dbBridge && (await this.fileSystem.exists(dbPath))

        if (restoredDatabase) {
          await this.dbBridge!.replaceAgentDatabaseFrom(dbPath)
        }

        const configPath = joinStoragePath(payloadDir, 'config/device_preferences.json')
        if (await this.fileSystem.exists(configPath)) {
          const raw = await this.fileSystem.readFile(configPath)
          const prefs = mergeArchivePrefsPreservingCloudSync(
            JSON.parse(raw) as Record<string, unknown>,
            preservedSettings.cloud_sync_config
          )
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

        // 路径校正由 vaultService.initRegistry() 负责（保留 lastAccessedAt 等字段，勿在此重写 registry）
        await this.vaultService.initRegistry()
        const globalShadowDir = await this.pathService.getGlobalShadowIndexDirectory()
        await purgeImportedShadowIndexCaches(this.fileSystem, {
          workspaceRoot: rootDir,
          globalShadowDir
        })
        reportArchiveImportStage(onProgress, 'rebuilding_index')
        if (this.dbBridge?.rebootstrapAfterArchiveRestore) {
          await this.dbBridge.rebootstrapAfterArchiveRestore()
        }
        reportArchiveImportStage(onProgress, 'finishing')
      } catch (restoreError) {
        throw new Error(formatArchiveImportFailureMessage(restoreError, snapshotPath))
      }

      return {
        fileCount: -1,
        profileRestored: true,
        snapshotPath
      }
    } finally {
      if (extractDir) {
        await this.fileSystem.rm(extractDir, { recursive: true, force: true }).catch(() => {})
      }
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

  private async getSnapshotDir(): Promise<string> {
    return this.pathService.getSnapshotsDirectory()
  }

  public async createSnapshot(options?: { preservePaths?: string[] }): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) return null

    const snapshotDir = await this.getSnapshotDir()
    await this.fileSystem.mkdir(snapshotDir, { recursive: true })

    const dt = new Date()
    const ts = [
      dt.getFullYear(),
      (dt.getMonth() + 1).toString().padStart(2, '0'),
      dt.getDate().toString().padStart(2, '0'),
      '_',
      dt.getHours().toString().padStart(2, '0'),
      dt.getMinutes().toString().padStart(2, '0'),
      dt.getSeconds().toString().padStart(2, '0'),
      dt.getMilliseconds().toString().padStart(3, '0')
    ].join('')
    const finalSnapPath = joinStoragePath(snapshotDir, `snapshot_${ts}.zip`)

    try {
      await this.fileSystem.rename(zipPath, finalSnapPath)
    } catch {
      await this.fileSystem.copyFile(zipPath, finalSnapPath)
      await this.fileSystem.unlink(zipPath).catch(() => {})
    }

    const maxCount = this.dbBridge ? await this.dbBridge.getMaxSnapshotCount() : 5
    const preservePaths = [
      normalizeStoragePath(finalSnapPath),
      ...(options?.preservePaths ?? []).map((p) => normalizeStoragePath(p))
    ]
    await this.pruneSnapshots(maxCount, preservePaths)
    return finalSnapPath
  }

  public async listSnapshots(): Promise<import('@baishou/core-mobile').SnapshotMeta[]> {
    const snapshotDir = await this.getSnapshotDir()
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
          createdAt: resolveSnapshotCreatedAt(filename, stat.mtimeMs),
          size: stat.size ?? 0
        })
      } catch {
        // skip
      }
    }
    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  public async restoreFromSnapshot(filename: string): Promise<ImportResult> {
    this.assertSafeSnapshotFilename(filename)
    const snapshotDir = await this.getSnapshotDir()
    const fullPath = joinStoragePath(snapshotDir, filename)
    if (!(await this.fileSystem.exists(fullPath))) {
      throw new Error('Snapshot not found')
    }
    return this.importFromZip(fullPath, true)
  }

  public async deleteSnapshot(filename: string): Promise<void> {
    this.assertSafeSnapshotFilename(filename)
    const snapshotDir = await this.getSnapshotDir()
    const fullPath = joinStoragePath(snapshotDir, filename)
    await this.fileSystem.unlink(fullPath)
  }

  private assertSafeSnapshotFilename(filename: string): void {
    assertSafeSnapshotFilename(filename)
  }

  private async pruneSnapshots(maxCount: number, preservePaths: string[] = []): Promise<void> {
    if (maxCount < 0) return

    const preserve = collectSnapshotPreserveKeys(preservePaths)
    const snapshotDir = normalizeStoragePath(await this.getSnapshotDir())
    let list = await this.listSnapshots()

    while (list.length > maxCount) {
      const oldestFirst = [...list].reverse()
      let deleted = false

      for (const item of oldestFirst) {
        const fullPath = normalizeStoragePath(`${snapshotDir}/${item.filename}`)
        if (preserve.absolutes.has(fullPath) || preserve.filenames.has(item.filename)) continue
        await this.deleteSnapshot(item.filename).catch(() => {})
        deleted = true
        break
      }

      if (!deleted) break
      list = await this.listSnapshots()
    }
  }

  private async resolveHasValidManifest(payloadDir: string): Promise<boolean> {
    const manifestPath = joinStoragePath(payloadDir, 'manifest.json')
    if (!(await this.fileSystem.exists(manifestPath))) return false
    try {
      const raw = await this.fileSystem.readFile(manifestPath)
      return isValidArchiveManifestContent(raw)
    } catch {
      return false
    }
  }

  private async validateExtractedArchive(
    extractDir: string,
    isFlutterLegacyZip: boolean
  ): Promise<void> {
    const entries = await this.fileSystem.readdir(extractDir)
    const meaningful = entries.filter((name) => name && name !== '.' && name !== '..')

    const manifestPath = joinStoragePath(extractDir, 'manifest.json')
    let hasValidManifest = false
    if (await this.fileSystem.exists(manifestPath)) {
      try {
        const raw = await this.fileSystem.readFile(manifestPath)
        hasValidManifest = isValidArchiveManifestContent(raw)
      } catch {
        hasValidManifest = false
      }
    }

    const hasDatabase = await this.fileSystem.exists(
      joinStoragePath(extractDir, MOBILE_ARCHIVE_DB_ZIP_NAME)
    )
    const hasVaultRegistry = await this.fileSystem.exists(
      joinStoragePath(extractDir, 'vault_registry.json')
    )

    let hasVaultDirectory = false
    for (const name of meaningful) {
      if (ARCHIVE_SKIP_TOP_LEVEL.has(name)) continue
      const entryPath = joinStoragePath(extractDir, name)
      try {
        const stat = await this.fileSystem.stat(entryPath)
        if (stat.isDirectory) {
          hasVaultDirectory = true
          break
        }
      } catch {
        // skip unreadable entries
      }
    }

    validateArchiveExtractPayload({
      isFlutterLegacyZip,
      isEmpty: meaningful.length === 0,
      hasValidManifest,
      hasDatabase,
      hasVaultRegistry,
      hasVaultDirectory
    })
  }

  private async packUserAvatarsForArchive(cacheDir: string): Promise<void> {
    const avatarsSrc = await this.pathService.getUserAvatarsDirectory()
    if (!(await this.fileSystem.exists(avatarsSrc))) return

    const avatarsDest = `${cacheDir}/${ARCHIVE_USER_AVATARS_ZIP_PREFIX}`
    await this.fileSystem.mkdir(avatarsDest, { recursive: true })

    const copyDir = async (src: string, dest: string) => {
      const entries = await this.fileSystem.readdir(src)
      for (const name of entries) {
        if (!name || name === '.' || name === '..') continue
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

  private async restoreUserAvatarsFromExtract(extractDir: string): Promise<void> {
    const avatarsSrc = joinStoragePath(extractDir, ARCHIVE_USER_AVATARS_ZIP_PREFIX)
    if (!(await this.fileSystem.exists(avatarsSrc))) return

    const avatarsDest = await this.pathService.getUserAvatarsDirectory()
    await this.fileSystem.rm(avatarsDest, { recursive: true, force: true }).catch(() => {})
    await this.fileSystem.mkdir(avatarsDest, { recursive: true })

    const copyDir = async (src: string, dest: string) => {
      const entries = await this.fileSystem.readdir(src)
      for (const name of entries) {
        const srcPath = joinStoragePath(src, name)
        const destPath = joinStoragePath(dest, name)
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

  private async storageRootHasData(rootDir: string): Promise<boolean> {
    try {
      if (!(await this.fileSystem.exists(rootDir))) return false
      const entries = await this.fileSystem.readdir(rootDir)
      return entries.some((name) => name && name !== '.' && name !== '..')
    } catch {
      return false
    }
  }

  private async shouldSkipPreImportSnapshot(zipFilePath: string): Promise<boolean> {
    const size = await this.resolveZipByteSize(zipFilePath)
    return size != null && size >= LARGE_ARCHIVE_IMPORT_BYTES
  }

  private async resolveZipByteSize(zipFilePath: string): Promise<number | null> {
    const candidates = [
      normalizeImportSourceUri(zipFilePath),
      zipFilePath,
      stripFileScheme(normalizeImportSourceUri(zipFilePath))
    ]

    for (const candidate of candidates) {
      try {
        if (!(await this.fileSystem.exists(candidate))) continue
        const stat = await this.fileSystem.stat(candidate)
        if (stat.isFile && typeof stat.size === 'number' && stat.size > 0) {
          return stat.size
        }
      } catch {
        // try next candidate
      }
    }

    return null
  }

  private async stageZipForUnzip(
    zipFilePath: string
  ): Promise<{ nativeZipPath: string; cleanupStagedZip?: () => Promise<void> }> {
    const normalized = normalizeImportSourceUri(zipFilePath)
    const needsStaging =
      normalized.startsWith('content://') ||
      normalized.startsWith('ph://') ||
      normalized.startsWith('data:')

    if (!needsStaging) {
      const nativeZipPath = stripFileScheme(normalized)
      if (await this.fileSystem.exists(normalized)) {
        return { nativeZipPath }
      }
      if (await this.fileSystem.exists(zipFilePath)) {
        return { nativeZipPath: stripFileScheme(zipFilePath) }
      }
    }

    const stagedZip = `${getAppCacheDirectory()}baishou_import_${Date.now()}.zip`
    await this.fileSystem.rm(stagedZip, { recursive: true, force: true }).catch(() => {})
    await importUriToPath(zipFilePath, stagedZip, this.fileSystem)
    return {
      nativeZipPath: stripFileScheme(stagedZip),
      cleanupStagedZip: async () => {
        await this.fileSystem.unlink(stagedZip).catch(() => {})
      }
    }
  }

  private async wipeStorageRootPreservingSnapshots(rootDir: string): Promise<void> {
    const entries = await this.fileSystem.readdir(rootDir).catch(() => [] as string[])
    for (const itemName of entries) {
      if (!itemName || itemName === '.' || itemName === '..') continue
      if (SNAPSHOT_STORAGE_DIR_NAMES.has(itemName)) continue
      await this.fileSystem
        .rm(joinStoragePath(rootDir, itemName), { recursive: true, force: true })
        .catch((e) => {
          console.warn('[MobileArchive] Failed to wipe storage entry', itemName, e)
        })
    }
  }

  private async selectiveCopy(sourceDirPath: string, targetDirPath: string) {
    const dirContent = await this.fileSystem.readdir(sourceDirPath)

    for (const itemName of dirContent) {
      if (!itemName || itemName === '.' || itemName === '..') continue
      if (SNAPSHOT_STORAGE_DIR_NAMES.has(itemName)) continue
      if (itemName.endsWith('-wal') || itemName.endsWith('-shm') || itemName.endsWith('-journal'))
        continue

      const fullSourcePath = joinStoragePath(sourceDirPath, itemName)
      const fullTargetPath = joinStoragePath(targetDirPath, itemName)

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
