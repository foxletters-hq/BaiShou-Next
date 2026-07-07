import i18n from 'i18next'
import { Platform } from 'react-native'
import { zip } from 'react-native-zip-archive'
import { isNativeArchiveExportAvailable, nativeZipArchiveExport } from 'expo-baishou-server'
import { FULL_BACKUP_EXCLUDED_ROOT_NAMES } from '@baishou/shared'
import type { IFileSystem, IStoragePathService } from '@baishou/core-mobile'
import { normalizeStoragePath, stripFileScheme } from './android-external-fs'
import { joinStoragePath } from './mobile-storage-path.util'
import {
  ARCHIVE_USER_AVATARS_ZIP_PREFIX,
  type MobileArchiveDbBridge
} from './mobile-archive-db.bridge'
import { SNAPSHOT_STORAGE_DIR_NAMES } from './archive-guards.util'

export type ArchiveExportContext = {
  pathService: IStoragePathService
  fileSystem: IFileSystem
  dbBridge?: MobileArchiveDbBridge
}

export function getArchiveExportStagingDir(rootDir: string): string {
  return joinStoragePath(rootDir, '.baishou/export_staging')
}

export async function exportArchiveToTempFileDirectZip(
  ctx: ArchiveExportContext,
  rootDir: string,
  supplementDir: string,
  targetZip: string
): Promise<void> {
  const zipSources: string[] = []

  try {
    const rootStat = await ctx.fileSystem.stat(rootDir)
    if (rootStat.isDirectory) {
      const entries = await ctx.fileSystem.readdir(rootDir)
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
    throw new Error(
      i18n.t(
        'auto.apps.mobile.src.services.archive.export.helpers.L52',
        '打包备份失败：未找到可导出的数据文件'
      )
    )
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

async function copyDirRecursive(fileSystem: IFileSystem, src: string, dest: string): Promise<void> {
  const entries = await fileSystem.readdir(src)
  for (const name of entries) {
    if (!name || name === '.' || name === '..') continue
    const srcPath = `${src}/${name}`
    const destPath = `${dest}/${name}`
    const stat = await fileSystem.stat(srcPath)
    if (stat.isDirectory) {
      await fileSystem.mkdir(destPath, { recursive: true })
      await copyDirRecursive(fileSystem, srcPath, destPath)
    } else {
      await fileSystem.copyFile(srcPath, destPath)
    }
  }
}

export async function packUserAvatarsForArchive(
  ctx: ArchiveExportContext,
  cacheDir: string
): Promise<void> {
  const avatarsSrc = await ctx.pathService.getUserAvatarsDirectory()
  if (!(await ctx.fileSystem.exists(avatarsSrc))) return

  const avatarsDest = `${cacheDir}/${ARCHIVE_USER_AVATARS_ZIP_PREFIX}`
  await ctx.fileSystem.mkdir(avatarsDest, { recursive: true })
  await copyDirRecursive(ctx.fileSystem, avatarsSrc, avatarsDest)
}

export async function legacyExportAsyncStoragePrefs(): Promise<Record<string, unknown>> {
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

export async function buildArchiveSupplement(
  ctx: ArchiveExportContext,
  cacheDir: string
): Promise<void> {
  try {
    await packUserAvatarsForArchive(ctx, cacheDir)
  } catch (e) {
    console.warn('[MobileArchive] Failed to pack user avatars', e)
  }

  try {
    const configDir = `${cacheDir}/config`
    await ctx.fileSystem.mkdir(configDir, { recursive: true })

    const prefs = ctx.dbBridge
      ? await ctx.dbBridge.exportDevicePreferences()
      : await legacyExportAsyncStoragePrefs()

    await ctx.fileSystem.writeFile(
      `${configDir}/device_preferences.json`,
      JSON.stringify(prefs, null, 2)
    )
  } catch (e) {
    console.warn('[MobileArchive] Failed to dump device preferences', e)
  }

  if (ctx.dbBridge) {
    const dbUri = await ctx.dbBridge.getAgentDatabaseUri()
    if (dbUri && (await ctx.fileSystem.exists(dbUri))) {
      const dbDir = `${cacheDir}/database`
      await ctx.fileSystem.mkdir(dbDir, { recursive: true })
      try {
        await ctx.fileSystem.copyFile(dbUri, `${dbDir}/baishou_agent.db`)
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
  await ctx.fileSystem.writeFile(`${cacheDir}/manifest.json`, JSON.stringify(manifest, null, 2))
}

export async function runArchiveExportToTempFile(
  ctx: ArchiveExportContext,
  flushBeforeExport: () => Promise<void>
): Promise<string | null> {
  await flushBeforeExport()

  const rootDir = normalizeStoragePath(await ctx.pathService.getRootDirectory())
  const stagingDir = getArchiveExportStagingDir(rootDir)
  await ctx.fileSystem.mkdir(stagingDir, { recursive: true })

  const supplementDir = joinStoragePath(stagingDir, `supplement_${Date.now()}`)
  await ctx.fileSystem.mkdir(supplementDir, { recursive: true })

  try {
    await buildArchiveSupplement(ctx, supplementDir)

    const targetZip = joinStoragePath(stagingDir, `BaiShou_Backup_${Date.now()}.zip`)

    if (Platform.OS === 'android') {
      if (!isNativeArchiveExportAvailable()) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.archive.export.helpers.L176',
            '全量备份需要新版原生导出模块。请执行 pnpm dev:mobile:clear 重新安装开发版（不可用 Expo Go）。'
          )
        )
      }

      const result = await nativeZipArchiveExport(rootDir, supplementDir, targetZip)
      await ctx.fileSystem.rm(supplementDir, { recursive: true, force: true }).catch(() => {})

      if (result.entryCount <= 0) {
        await ctx.fileSystem.unlink(targetZip).catch(() => {})
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.services.archive.export.helpers.L52',
            '打包备份失败：未找到可导出的数据文件'
          )
        )
      }

      return targetZip
    }

    await exportArchiveToTempFileDirectZip(ctx, rootDir, supplementDir, targetZip)
    await ctx.fileSystem.rm(supplementDir, { recursive: true, force: true }).catch(() => {})
    return targetZip
  } catch (err) {
    await ctx.fileSystem.rm(supplementDir, { recursive: true, force: true }).catch(() => {})
    throw err
  }
}
