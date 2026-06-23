import * as fs from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { logger } from '@baishou/shared'
import {
  hasFlutterLegacyStorageMarkers,
  isMigrationCompleted,
  isLegacyAppRoot,
  targetDirectoryHasData
} from '@baishou/core/shared'
import { createNodeFileSystem } from '@baishou/core-desktop'
import { connectionManager, installDatabaseSchema } from '@baishou/database-desktop'
import { resolveLegacyRootCandidates } from './flutter-legacy-paths.service'
import { LegacyMigrationService } from './legacy-migration.service'
import { getDesktopInstallInstanceId } from './install-instance.service'
import { getAppDb, resetAppDb } from '../db'
import { isDesktopDevRuntime, resolveDefaultDevStorageRoot, resolveDevEffectiveStorageRoot, shouldRewriteDevStorageRoot } from '../dev-user-data'

export interface DesktopLegacyBootstrapResult {
  storageRoot: string
  needsOnboarding: boolean
  migrated: boolean
}

async function runLegacyMigration(targetDir: string): Promise<void> {
  const installInstanceId = await getDesktopInstallInstanceId()
  const legacyService = new LegacyMigrationService()
  await legacyService.migrate(targetDir, targetDir, {
    source: 'flutter_desktop',
    installInstanceId
  })
  resetAppDb()
  const migratedDb = getAppDb(targetDir)
  connectionManager.setDb(migratedDb)
  await installDatabaseSchema(migratedDb)
}

/**
 * 启动时解析存储根目录，并在检测到 Flutter 旧版数据时自动迁移。
 * 覆盖：首次安装、已完成引导但指向空目录、以及指向 legacy 根但未写入迁移标记等情况。
 */
export async function resolveDesktopStorageBootstrap(
  settingsPath: string
): Promise<DesktopLegacyBootstrapResult> {
  let customStorageRoot = ''
  let needsOnboarding = true

  try {
    const data = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(data) as { custom_storage_root?: string }
    if (settings.custom_storage_root?.trim()) {
      customStorageRoot = settings.custom_storage_root.trim()
      needsOnboarding = false
    }
  } catch {
    // no settings yet
  }

  if (isDesktopDevRuntime()) {
    if (shouldRewriteDevStorageRoot(customStorageRoot)) {
      const devRoot = resolveDevEffectiveStorageRoot(customStorageRoot)
      logger.warn(
        `[DesktopLegacyBootstrap] Dev runtime ignored external storage root (${customStorageRoot}); using ${devRoot}`
      )
      customStorageRoot = devRoot
      needsOnboarding = false
      await fs.mkdir(devRoot, { recursive: true })
      await fs.writeFile(
        settingsPath,
        JSON.stringify({ custom_storage_root: devRoot }, null, 2),
        'utf-8'
      )
    } else if (customStorageRoot) {
      customStorageRoot = resolveDevEffectiveStorageRoot(customStorageRoot)
    }
  }

  const legacyCandidates = isDesktopDevRuntime() ? [] : await resolveLegacyRootCandidates()
  const primaryLegacy = legacyCandidates[0] ?? null
  const fileSystem = createNodeFileSystem()

  // 开发版不自动挂载本机 Flutter 旧版 / 稳定版工作区，避免 dev 与生产数据混用
  if (!isDesktopDevRuntime() && needsOnboarding && primaryLegacy && !customStorageRoot) {
    customStorageRoot = primaryLegacy
  }

  const isWorkspaceMigrationDone = async (root: string) => isMigrationCompleted(fileSystem, root)

  const persistStorageRoot = async (root: string) => {
    await fs.writeFile(
      settingsPath,
      JSON.stringify({ custom_storage_root: root }, null, 2),
      'utf-8'
    )
  }

  try {
    if (customStorageRoot) {
      const isFlutterLegacy = await hasFlutterLegacyStorageMarkers(fileSystem, customStorageRoot)
      const alreadyMigrated = await isWorkspaceMigrationDone(customStorageRoot)

      if (isFlutterLegacy && !alreadyMigrated && !isDesktopDevRuntime()) {
        logger.info('[DesktopLegacyBootstrap] Migrating legacy installation at', customStorageRoot)
        await runLegacyMigration(customStorageRoot)
        await persistStorageRoot(customStorageRoot)
        return { storageRoot: customStorageRoot, needsOnboarding: false, migrated: true }
      }

      if (!isDesktopDevRuntime() && !isFlutterLegacy && primaryLegacy) {
        const currentHasData = await targetDirectoryHasData(fileSystem, customStorageRoot)
        const legacyAlreadyMigrated = await isWorkspaceMigrationDone(primaryLegacy)
        if (!currentHasData && !legacyAlreadyMigrated) {
          logger.info(
            '[DesktopLegacyBootstrap] Current storage is empty; adopting legacy data from',
            primaryLegacy
          )
          await runLegacyMigration(primaryLegacy)
          customStorageRoot = primaryLegacy
          await persistStorageRoot(customStorageRoot)
          return { storageRoot: customStorageRoot, needsOnboarding: false, migrated: true }
        }
      }

      if (isFlutterLegacy && needsOnboarding) {
        await persistStorageRoot(customStorageRoot)
        return { storageRoot: customStorageRoot, needsOnboarding: false, migrated: false }
      }

      if (customStorageRoot && !needsOnboarding) {
        return { storageRoot: customStorageRoot, needsOnboarding: false, migrated: false }
      }
    }
  } catch (e) {
    logger.error('[DesktopLegacyBootstrap] Legacy migration failed:', e as Error)
    if (!isDesktopDevRuntime() && primaryLegacy) {
      const currentHasData = customStorageRoot
        ? await targetDirectoryHasData(fileSystem, customStorageRoot).catch(() => false)
        : false
      if (!currentHasData) {
        customStorageRoot = primaryLegacy
        needsOnboarding = false
      }
    }
  }

  const devDefaultRoot = isDesktopDevRuntime() ? resolveDefaultDevStorageRoot() : ''

  return {
    storageRoot: customStorageRoot || (isDesktopDevRuntime() ? devDefaultRoot : primaryLegacy || ''),
    needsOnboarding,
    migrated: false
  }
}

/** 引导页选目录：已是 Flutter 旧版根目录则原样使用，否则追加 baishou-data 子目录 */
export async function resolvePickedStorageDirectory(pickedPath: string): Promise<string> {
  const normalized = pickedPath.trim()
  if (!normalized) return normalized

  const fileSystem = createNodeFileSystem()
  if (await isLegacyAppRoot(fileSystem, normalized)) {
    return normalized
  }

  const separator = normalized.includes('\\') ? '\\' : '/'
  const dirSuffix = 'baishou-data'
  return normalized.endsWith(separator)
    ? `${normalized}${dirSuffix}`
    : `${normalized}${separator}${dirSuffix}`
}

export function defaultOnboardingStoragePath(): string {
  return isDesktopDevRuntime()
    ? resolveDefaultDevStorageRoot()
    : join(app.getPath('userData'), 'Vaults')
}
