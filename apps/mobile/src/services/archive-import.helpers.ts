import i18n from 'i18next'
import { Platform } from 'react-native'
import { unzip } from 'react-native-zip-archive'
import {
  isNativeArchiveImportAvailable,
  nativeCopyArchiveExtractToRoot,
  nativeUnzipArchive
} from 'expo-baishou-server'
import {
  ImportResult,
  VaultService,
  shouldImportArchiveAsFlutterLegacy,
  purgeImportedShadowIndexCaches,
  resolveAgentDbPath,
  resolveArchivePayloadRoot,
  mergeArchivePrefsPreservingCloudSync,
  resolveLegacyImportVaultNames,
  type IFileSystem,
  type IStoragePathService
} from '@baishou/core-mobile'
import { resetIncrementalSyncMetaAfterFullRestore } from '@baishou/shared'
import { normalizeStoragePath, stripFileScheme } from './android-external-fs'
import { getAppCacheDirectory } from './mobile-app-paths'
import { joinStoragePath } from './mobile-storage-path.util'
import { importUriToPath, normalizeImportSourceUri } from './mobile-uri-import'
import {
  ARCHIVE_SKIP_TOP_LEVEL,
  formatArchiveImportFailureMessage,
  isValidArchiveManifestContent,
  LARGE_ARCHIVE_IMPORT_BYTES,
  validateArchiveExtractPayload,
  estimateLegacyFlutterZipCopyFiles,
  formatArchiveImportEntryDetail,
  reportArchiveImportStage,
  type ArchiveImportProgressCallback
} from './archive-guards.util'
import {
  MOBILE_ARCHIVE_DB_ZIP_NAME,
  ARCHIVE_USER_AVATARS_ZIP_PREFIX,
  type MobileArchiveDbBridge,
  type ArchiveRestoreRebootstrapOptions
} from './mobile-archive-db.bridge'
import {
  wipeStorageRootPreservingSnapshots,
  selectiveCopyArchiveTree
} from './archive-snapshot.helpers'

export type ArchiveImportContext = {
  pathService: IStoragePathService
  vaultService: VaultService
  fileSystem: IFileSystem
  dbBridge?: MobileArchiveDbBridge
}

export async function legacyImportAsyncStoragePrefs(prefs: Record<string, string>): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
  for (const [k, v] of Object.entries(prefs)) {
    if (typeof v === 'string') {
      await AsyncStorage.setItem(k, v)
    }
  }
}

export async function storageRootHasData(
  ctx: ArchiveImportContext,
  rootDir: string
): Promise<boolean> {
  try {
    if (!(await ctx.fileSystem.exists(rootDir))) return false
    const entries = await ctx.fileSystem.readdir(rootDir)
    return entries.some((name) => name && name !== '.' && name !== '..')
  } catch {
    return false
  }
}

export async function resolveZipByteSize(
  ctx: ArchiveImportContext,
  zipFilePath: string
): Promise<number | null> {
  const candidates = [
    normalizeImportSourceUri(zipFilePath),
    zipFilePath,
    stripFileScheme(normalizeImportSourceUri(zipFilePath))
  ]

  for (const candidate of candidates) {
    try {
      if (!(await ctx.fileSystem.exists(candidate))) continue
      const stat = await ctx.fileSystem.stat(candidate)
      if (stat.isFile && typeof stat.size === 'number' && stat.size > 0) {
        return stat.size
      }
    } catch {
      // try next candidate
    }
  }

  return null
}

export async function shouldSkipPreImportSnapshot(
  ctx: ArchiveImportContext,
  zipFilePath: string
): Promise<boolean> {
  const size = await resolveZipByteSize(ctx, zipFilePath)
  return size != null && size >= LARGE_ARCHIVE_IMPORT_BYTES
}

export async function stageZipForUnzip(
  ctx: ArchiveImportContext,
  zipFilePath: string
): Promise<{ nativeZipPath: string; cleanupStagedZip?: () => Promise<void> }> {
  const normalized = normalizeImportSourceUri(zipFilePath)
  const needsStaging =
    normalized.startsWith('content://') ||
    normalized.startsWith('ph://') ||
    normalized.startsWith('data:')

  if (!needsStaging) {
    const nativeZipPath = stripFileScheme(normalized)
    if (await ctx.fileSystem.exists(normalized)) {
      return { nativeZipPath }
    }
    if (await ctx.fileSystem.exists(zipFilePath)) {
      return { nativeZipPath: stripFileScheme(zipFilePath) }
    }
  }

  const stagedZip = `${getAppCacheDirectory()}baishou_import_${Date.now()}.zip`
  await ctx.fileSystem.rm(stagedZip, { recursive: true, force: true }).catch(() => {})
  await importUriToPath(zipFilePath, stagedZip, ctx.fileSystem)
  return {
    nativeZipPath: stripFileScheme(stagedZip),
    cleanupStagedZip: async () => {
      await ctx.fileSystem.unlink(stagedZip).catch(() => {})
    }
  }
}

export async function resolveHasValidManifest(
  ctx: ArchiveImportContext,
  payloadDir: string
): Promise<boolean> {
  const manifestPath = joinStoragePath(payloadDir, 'manifest.json')
  if (!(await ctx.fileSystem.exists(manifestPath))) return false
  try {
    const raw = await ctx.fileSystem.readFile(manifestPath)
    return isValidArchiveManifestContent(raw)
  } catch {
    return false
  }
}

export async function validateExtractedArchive(
  ctx: ArchiveImportContext,
  extractDir: string,
  isFlutterLegacyZip: boolean
): Promise<void> {
  const entries = await ctx.fileSystem.readdir(extractDir)
  const meaningful = entries.filter((name) => name && name !== '.' && name !== '..')

  const manifestPath = joinStoragePath(extractDir, 'manifest.json')
  let hasValidManifest = false
  if (await ctx.fileSystem.exists(manifestPath)) {
    try {
      const raw = await ctx.fileSystem.readFile(manifestPath)
      hasValidManifest = isValidArchiveManifestContent(raw)
    } catch {
      hasValidManifest = false
    }
  }

  const hasDatabase = await ctx.fileSystem.exists(
    joinStoragePath(extractDir, MOBILE_ARCHIVE_DB_ZIP_NAME)
  )
  const hasVaultRegistry = await ctx.fileSystem.exists(
    joinStoragePath(extractDir, 'vault_registry.json')
  )

  let hasVaultDirectory = false
  for (const name of meaningful) {
    if (ARCHIVE_SKIP_TOP_LEVEL.has(name)) continue
    const entryPath = joinStoragePath(extractDir, name)
    try {
      const stat = await ctx.fileSystem.stat(entryPath)
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

export async function restoreUserAvatarsFromExtract(
  ctx: ArchiveImportContext,
  extractDir: string
): Promise<void> {
  const avatarsSrc = joinStoragePath(extractDir, ARCHIVE_USER_AVATARS_ZIP_PREFIX)
  if (!(await ctx.fileSystem.exists(avatarsSrc))) return

  const avatarsDest = await ctx.pathService.getUserAvatarsDirectory()
  await ctx.fileSystem.rm(avatarsDest, { recursive: true, force: true }).catch(() => {})
  await ctx.fileSystem.mkdir(avatarsDest, { recursive: true })

  const copyDir = async (src: string, dest: string) => {
    const entries = await ctx.fileSystem.readdir(src)
    for (const name of entries) {
      const srcPath = joinStoragePath(src, name)
      const destPath = joinStoragePath(dest, name)
      const stat = await ctx.fileSystem.stat(srcPath)
      if (stat.isDirectory) {
        await ctx.fileSystem.mkdir(destPath, { recursive: true })
        await copyDir(srcPath, destPath)
      } else {
        await ctx.fileSystem.copyFile(srcPath, destPath)
      }
    }
  }

  await copyDir(avatarsSrc, avatarsDest)
}

export async function runArchiveImportFromZip(
  ctx: ArchiveImportContext,
  zipFilePath: string,
  createSnapshotBefore: boolean,
  createSnapshot: (options?: { preservePaths?: string[] }) => Promise<string | null>,
  onProgress?: ArchiveImportProgressCallback
): Promise<ImportResult> {
  let snapshotPath: string | undefined

  const rootDir = normalizeStoragePath(await ctx.pathService.getRootDirectory())
  await ctx.fileSystem.mkdir(rootDir, { recursive: true })

  const preserveDuringSnapshot = normalizeStoragePath(zipFilePath)
  const skipPreImportSnapshot = await shouldSkipPreImportSnapshot(ctx, zipFilePath)

  reportArchiveImportStage(onProgress, 'preparing')
  if (createSnapshotBefore && !skipPreImportSnapshot && (await storageRootHasData(ctx, rootDir))) {
    try {
      reportArchiveImportStage(onProgress, 'snapshot')
      const snap = await createSnapshot({ preservePaths: [preserveDuringSnapshot] })
      if (!snap) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.archive.import.helpers.L255',
            '导入前创建保护快照失败，已中止导入以保护当前数据'
          )
        )
      }
      snapshotPath = snap
    } catch (e) {
      console.error('[MobileArchive] Pre-import snapshot failed', e)
      const detail = e instanceof Error ? e.message : String(e)
      const snapshotLabel = i18n.t(
        'auto.apps.mobile.src.services.archive.import.helpers.L262',
        '保护快照'
      )
      throw new Error(
        detail.includes(snapshotLabel)
          ? detail
          : i18n.t(
              'auto.apps.mobile.src.services.archive.import.helpers.L262_detail',
              '导入前创建保护快照失败，已中止导入（{{detail}}）',
              { detail }
            )
      )
    }
  }

  let extractDir: string | undefined
  try {
    extractDir = joinStoragePath(
      stripFileScheme(getAppCacheDirectory()),
      `baishou_archive_extract_${Date.now()}`
    )
    await ctx.fileSystem.mkdir(extractDir, { recursive: true })

    reportArchiveImportStage(onProgress, 'unpacking')
    const { nativeZipPath, cleanupStagedZip } = await stageZipForUnzip(ctx, zipFilePath)
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

    const payloadDir = await resolveArchivePayloadRoot(ctx.fileSystem, extractDir)

    reportArchiveImportStage(onProgress, 'validating')
    const preservedSettings = ctx.dbBridge ? await ctx.dbBridge.readPreservedImportSettings() : {}

    const hasValidManifest = await resolveHasValidManifest(ctx, payloadDir)
    const isFlutterLegacyZip = await shouldImportArchiveAsFlutterLegacy(
      ctx.fileSystem,
      payloadDir,
      hasValidManifest
    )
    await validateExtractedArchive(ctx, payloadDir, isFlutterLegacyZip)

    if (isFlutterLegacyZip) {
      if (!ctx.dbBridge?.importLegacyFlutterZip) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.archive.import.helpers.L313',
            '当前环境不支持导入 Flutter 旧版备份包'
          )
        )
      }

      try {
        const vaultNames = await resolveLegacyImportVaultNames(ctx.fileSystem, payloadDir)
        const copyTotal = await estimateLegacyFlutterZipCopyFiles(
          ctx.fileSystem,
          payloadDir,
          vaultNames
        )
        let copyCurrent = 0
        reportArchiveImportStage(onProgress, 'migrating_legacy', {
          detail: i18n.t(
            'auto.apps.mobile.src.services.archive.import.helpers.L325',
            '正在准备工作区…'
          ),
          subCurrent: 0,
          subTotal: copyTotal
        })
        try {
          await wipeStorageRootPreservingSnapshots(ctx, rootDir)
        } catch (e) {
          console.warn('[MobileArchive] Wipe root warning (legacy zip)', e)
        }
        await ctx.fileSystem.mkdir(rootDir, { recursive: true })

        await ctx.dbBridge.importLegacyFlutterZip(payloadDir, rootDir, {
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
        if (ctx.dbBridge && (await ctx.fileSystem.exists(stagedAgentDb))) {
          await ctx.dbBridge.replaceAgentDatabaseFrom(stagedAgentDb)
        }

        try {
          const syncMetaDir = `${rootDir}/.baishou`
          await resetIncrementalSyncMetaAfterFullRestore(syncMetaDir, {
            exists: (p) => ctx.fileSystem.exists(p),
            read: (p) => ctx.fileSystem.readFile(p),
            write: (p, content) => ctx.fileSystem.writeFile(p, content),
            unlink: (p) => ctx.fileSystem.unlink(p)
          })
        } catch (e) {
          console.warn('[MobileArchive] Failed to reset incremental sync meta (legacy zip)', e)
        }

        await ctx.vaultService.initRegistry()
        const globalShadowDir = await ctx.pathService.getGlobalShadowIndexDirectory()
        await purgeImportedShadowIndexCaches(ctx.fileSystem, {
          workspaceRoot: rootDir,
          globalShadowDir
        })

        reportArchiveImportStage(onProgress, 'rebuilding_index')
        const rebootstrapOptions: ArchiveRestoreRebootstrapOptions = {
          blockingResync: false,
          deferSummaryScan: true
        }
        if (ctx.dbBridge?.rebootstrapAfterArchiveRestore) {
          await ctx.dbBridge.rebootstrapAfterArchiveRestore(rebootstrapOptions)
        }

        const legacyConfigPath = joinStoragePath(payloadDir, 'config/device_preferences.json')
        if (
          (await ctx.fileSystem.exists(legacyConfigPath)) &&
          ctx.dbBridge?.importDevicePreferences
        ) {
          const raw = await ctx.fileSystem.readFile(legacyConfigPath)
          const prefs = mergeArchivePrefsPreservingCloudSync(
            JSON.parse(raw) as Record<string, unknown>,
            preservedSettings.cloud_sync_config
          )
          await ctx.dbBridge.importDevicePreferences(prefs)
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
        await wipeStorageRootPreservingSnapshots(ctx, rootDir)
      } catch (e) {
        console.warn('[MobileArchive] Wipe root warning', e)
      }
      await ctx.fileSystem.mkdir(rootDir, { recursive: true })

      if (useNativeArchiveImport) {
        await nativeCopyArchiveExtractToRoot(payloadDir, rootDir)
      } else {
        const entries = await ctx.fileSystem.readdir(payloadDir)
        for (const name of entries) {
          if (!name || name === '.' || name === '..') continue
          if (ARCHIVE_SKIP_TOP_LEVEL.has(name)) continue
          const src = joinStoragePath(payloadDir, name)
          const dest = joinStoragePath(rootDir, name)
          const stat = await ctx.fileSystem.stat(src)
          if (stat.isDirectory) {
            await ctx.fileSystem.mkdir(dest, { recursive: true })
            await selectiveCopyArchiveTree(ctx, src, dest)
          } else if (stat.isFile) {
            await ctx.fileSystem.copyFile(src, dest)
          }
        }
      }

      await restoreUserAvatarsFromExtract(ctx, payloadDir)

      const dbPath = joinStoragePath(payloadDir, MOBILE_ARCHIVE_DB_ZIP_NAME)
      const restoredDatabase = !!ctx.dbBridge && (await ctx.fileSystem.exists(dbPath))

      if (restoredDatabase) {
        await ctx.dbBridge!.replaceAgentDatabaseFrom(dbPath)
      }

      const configPath = joinStoragePath(payloadDir, 'config/device_preferences.json')
      if (await ctx.fileSystem.exists(configPath)) {
        const raw = await ctx.fileSystem.readFile(configPath)
        const prefs = mergeArchivePrefsPreservingCloudSync(
          JSON.parse(raw) as Record<string, unknown>,
          preservedSettings.cloud_sync_config
        )
        if (ctx.dbBridge) {
          await ctx.dbBridge.importDevicePreferences(prefs)
        } else {
          await legacyImportAsyncStoragePrefs(prefs as Record<string, string>)
        }
      }

      try {
        const syncMetaDir = `${rootDir}/.baishou`
        await resetIncrementalSyncMetaAfterFullRestore(syncMetaDir, {
          exists: (p) => ctx.fileSystem.exists(p),
          read: (p) => ctx.fileSystem.readFile(p),
          write: (p, content) => ctx.fileSystem.writeFile(p, content),
          unlink: (p) => ctx.fileSystem.unlink(p)
        })
      } catch (e) {
        console.warn('[MobileArchive] Failed to reset incremental sync meta', e)
      }

      await ctx.vaultService.initRegistry()
      const globalShadowDir = await ctx.pathService.getGlobalShadowIndexDirectory()
      await purgeImportedShadowIndexCaches(ctx.fileSystem, {
        workspaceRoot: rootDir,
        globalShadowDir
      })
      reportArchiveImportStage(onProgress, 'rebuilding_index')
      if (ctx.dbBridge?.rebootstrapAfterArchiveRestore) {
        await ctx.dbBridge.rebootstrapAfterArchiveRestore()
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
      await ctx.fileSystem.rm(extractDir, { recursive: true, force: true }).catch(() => {})
    }
  }
}
