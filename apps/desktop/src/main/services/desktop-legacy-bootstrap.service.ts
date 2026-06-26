import * as fs from 'fs/promises'
import { dirname, join } from 'path'
import { app } from 'electron'
import { logger, isSameStorageRoot } from '@baishou/shared'
import {
  detectFlutterLegacyMigrationPending,
  isLegacyAppRoot,
  isValidWorkspaceRoot,
  sanitizePersistedWorkspaceRoot,
  type FlutterLegacyMigrationPending
} from '@baishou/core/shared'
import { createNodeFileSystem } from '@baishou/core-desktop'
import { connectionManager, installDatabaseSchema } from '@baishou/database-desktop'
import {
  buildLegacyRootCandidateInputs,
  resolveScoredLegacyRootCandidates
} from './flutter-legacy-paths.service'
import { LegacyMigrationService } from './legacy-migration.service'
import { getDesktopInstallInstanceId } from './install-instance.service'
import { getAppDb, resetAppDb } from '../db'
import { isDesktopDevBuild } from '../app-identity'

export interface DesktopLegacyBootstrapResult {
  storageRoot: string
  needsOnboarding: boolean
  migrated: boolean
  pendingFlutterLegacyMigration: FlutterLegacyMigrationPending | null
}

export {
  resolveLegacyMigrationTargetRoot,
  sanitizePersistedWorkspaceRoot
} from '@baishou/core/shared'

interface DesktopSettingsFile {
  custom_storage_root?: string
  onboarding_completed?: boolean
  /** 引导中途已选目录但未 finish；用于区分升级老用户与未完成引导。 */
  onboarding_in_progress?: boolean
}

const LEGACY_PROMPT_DISMISSED_FILE = 'legacy_migration_prompt_dismissed.json'

async function readDesktopSettingsFile(settingsPath: string): Promise<DesktopSettingsFile> {
  try {
    const data = await fs.readFile(settingsPath, 'utf-8')
    return JSON.parse(data) as DesktopSettingsFile
  } catch {
    return {}
  }
}

async function writeDesktopSettingsFile(
  settingsPath: string,
  settings: DesktopSettingsFile
): Promise<void> {
  await fs.mkdir(dirname(settingsPath), { recursive: true })
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function isDesktopOnboardingCompleted(settingsPath: string): Promise<boolean> {
  const settings = await readDesktopSettingsFile(settingsPath)
  return settings.onboarding_completed === true
}

export async function markDesktopOnboardingCompleted(settingsPath: string): Promise<void> {
  const settings = await readDesktopSettingsFile(settingsPath)
  if (settings.onboarding_completed === true) return
  settings.onboarding_completed = true
  delete settings.onboarding_in_progress
  await writeDesktopSettingsFile(settingsPath, settings)
}

/** 升级老用户：已有存储路径且从未进入「引导中途」状态，视为已完成引导。 */
async function maybeCompleteOnboardingForLegacyInstall(
  settingsPath: string,
  settings: DesktopSettingsFile
): Promise<void> {
  if (settings.onboarding_completed === true) return
  if (settings.onboarding_in_progress === true) return
  if (!settings.custom_storage_root?.trim()) return
  await markDesktopOnboardingCompleted(settingsPath)
}

export async function writeDesktopOnboardingDirectory(
  settingsPath: string,
  dirPath: string
): Promise<void> {
  const settings = await readDesktopSettingsFile(settingsPath)
  settings.custom_storage_root = sanitizePersistedWorkspaceRoot(dirPath)
  if (settings.onboarding_completed !== true) {
    settings.onboarding_in_progress = true
  }
  await writeDesktopSettingsFile(settingsPath, settings)
}

export async function finishDesktopOnboarding(settingsPath: string): Promise<void> {
  const settings = await readDesktopSettingsFile(settingsPath)
  if (!settings.custom_storage_root?.trim()) {
    settings.custom_storage_root = defaultDesktopStorageRoot()
    logger.info('[Onboarding] Persisted default storage root:', settings.custom_storage_root)
  }
  settings.onboarding_completed = true
  delete settings.onboarding_in_progress
  await writeDesktopSettingsFile(settingsPath, settings)
}

export function validateFlutterLegacyMigrationTarget(targetDir: string): string {
  const sanitized = sanitizePersistedWorkspaceRoot(targetDir.trim())
  if (!isValidWorkspaceRoot(sanitized)) {
    throw new Error('Invalid migration target directory')
  }
  return sanitized
}

function normalizeComparablePath(filePath: string): string {
  return sanitizePersistedWorkspaceRoot(filePath).replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
}

export function resolveLegacyDesktopSettingsCandidates(appDataDir: string): string[] {
  return [join(appDataDir, '@baishou', 'desktop', 'baishou_settings.json')]
}

export function defaultDesktopStorageRoot(): string {
  if (isDesktopDevBuild()) {
    return join(app.getPath('userData'), 'Vaults')
  }
  return join(app.getPath('documents'), 'BaiShou_Root')
}

async function readStorageRootFromSettingsFile(settingsPath: string): Promise<string | null> {
  const settings = await readDesktopSettingsFile(settingsPath)
  return settings.custom_storage_root?.trim() || null
}

async function recoverStorageRootFromLegacyDesktopSettings(
  settingsPath: string
): Promise<string | null> {
  const currentSettingsPath = normalizeComparablePath(settingsPath)
  for (const candidate of resolveLegacyDesktopSettingsCandidates(app.getPath('appData'))) {
    if (normalizeComparablePath(candidate) === currentSettingsPath) continue
    const root = await readStorageRootFromSettingsFile(candidate)
    if (root) return root
  }
  return null
}

async function persistStorageRoot(settingsPath: string, root: string): Promise<void> {
  const settings = await readDesktopSettingsFile(settingsPath)
  settings.custom_storage_root = sanitizePersistedWorkspaceRoot(root)
  await writeDesktopSettingsFile(settingsPath, settings)
}

export async function isDesktopLegacyMigrationPromptDismissed(): Promise<boolean> {
  try {
    const dismissedPath = join(app.getPath('userData'), LEGACY_PROMPT_DISMISSED_FILE)
    const raw = await fs.readFile(dismissedPath, 'utf-8')
    const parsed = JSON.parse(raw) as { dismissed?: boolean }
    return parsed.dismissed === true
  } catch {
    return false
  }
}

export async function dismissDesktopLegacyMigrationPrompt(): Promise<void> {
  const dismissedPath = join(app.getPath('userData'), LEGACY_PROMPT_DISMISSED_FILE)
  await fs.mkdir(dirname(dismissedPath), { recursive: true })
  await fs.writeFile(dismissedPath, JSON.stringify({ dismissed: true }, null, 2), 'utf-8')
}

export async function runDesktopFlutterLegacyMigration(
  sourceDir: string,
  targetDir: string
): Promise<void> {
  const safeTarget = validateFlutterLegacyMigrationTarget(targetDir)
  const installInstanceId = await getDesktopInstallInstanceId()
  const legacyService = new LegacyMigrationService()
  await legacyService.migrate(sourceDir, safeTarget, {
    source: 'flutter_desktop',
    installInstanceId
  })
  resetAppDb()
  const migratedDb = getAppDb(safeTarget)
  connectionManager.setDb(migratedDb)
  await installDatabaseSchema(migratedDb)
}

export async function resolvePendingFlutterLegacyMigration(
  settingsPath: string
): Promise<FlutterLegacyMigrationPending | null> {
  if (!(await isDesktopOnboardingCompleted(settingsPath))) return null
  if (await isDesktopLegacyMigrationPromptDismissed()) return null
  const bootstrap = await resolveDesktopStorageBootstrap(settingsPath)
  return bootstrap.pendingFlutterLegacyMigration
}

export async function detectDesktopFlutterLegacyMigrationPending(
  storageRoot: string
): Promise<FlutterLegacyMigrationPending | null> {
  const fileSystem = createNodeFileSystem()
  const installInstanceId = await getDesktopInstallInstanceId()
  const rawCandidates = await buildLegacyRootCandidateInputs()
  const hasStorageRoot = rawCandidates.some((candidate) =>
    isSameStorageRoot(candidate.path, storageRoot)
  )
  if (!hasStorageRoot && storageRoot.trim()) {
    rawCandidates.unshift({ path: storageRoot, fromFlutterSp: false })
  }

  return detectFlutterLegacyMigrationPending(fileSystem, {
    targetRoot: storageRoot,
    installInstanceId,
    rawCandidates
  })
}

/**
 * 启动时解析存储根目录，并检测 Flutter 旧版数据（不自动迁移，由用户确认后执行）。
 */
export async function resolveDesktopStorageBootstrap(
  settingsPath: string
): Promise<DesktopLegacyBootstrapResult> {
  let customStorageRoot = ''

  const settingsAtStart = await readDesktopSettingsFile(settingsPath)
  const existingRoot = settingsAtStart.custom_storage_root?.trim() || null

  if (existingRoot) {
    customStorageRoot = sanitizePersistedWorkspaceRoot(existingRoot)
    if (normalizeComparablePath(existingRoot) !== normalizeComparablePath(customStorageRoot)) {
      await persistStorageRoot(settingsPath, customStorageRoot)
      logger.info(
        `[DesktopLegacyBootstrap] Sanitized persisted storage root: ${existingRoot} -> ${customStorageRoot}`
      )
    }
    await maybeCompleteOnboardingForLegacyInstall(settingsPath, settingsAtStart)
  } else {
    const recoveredRoot = await recoverStorageRootFromLegacyDesktopSettings(settingsPath)
    if (recoveredRoot) {
      customStorageRoot = sanitizePersistedWorkspaceRoot(recoveredRoot)
      await persistStorageRoot(settingsPath, customStorageRoot)
      await markDesktopOnboardingCompleted(settingsPath)
      logger.info('[DesktopLegacyBootstrap] Recovered storage root from legacy desktop settings')
    }
  }

  if (!customStorageRoot) {
    customStorageRoot = defaultDesktopStorageRoot()
  }

  const needsOnboarding = !(await isDesktopOnboardingCompleted(settingsPath))
  const safeStorageRoot = sanitizePersistedWorkspaceRoot(customStorageRoot)
  const scoredLegacy = await resolveScoredLegacyRootCandidates()
  if (scoredLegacy.length > 0) {
    const primary = scoredLegacy[0]!
    logger.info(
      `[DesktopLegacyBootstrap] Legacy candidate detected: ${primary.path} score=${primary.score} reasons=${primary.reasons.join(',')}`
    )
  }

  const pendingFlutterLegacyMigration =
    await detectDesktopFlutterLegacyMigrationPending(safeStorageRoot)

  if (pendingFlutterLegacyMigration) {
    logger.info(
      `[DesktopLegacyBootstrap] Pending Flutter legacy migration: ${pendingFlutterLegacyMigration.sourceRoot} -> ${pendingFlutterLegacyMigration.targetRoot} (${pendingFlutterLegacyMigration.detectionReason})`
    )
  }

  return {
    storageRoot: safeStorageRoot,
    needsOnboarding,
    migrated: false,
    pendingFlutterLegacyMigration
  }
}

/** 引导页选目录：已是 Flutter 旧版根目录则落到安全子目录，否则追加 baishou-data 子目录 */
export async function resolvePickedStorageDirectory(pickedPath: string): Promise<string> {
  const normalized = pickedPath.trim()
  if (!normalized) return normalized

  const fileSystem = createNodeFileSystem()
  if (await isLegacyAppRoot(fileSystem, normalized)) {
    return sanitizePersistedWorkspaceRoot(normalized)
  }

  const separator = normalized.includes('\\') ? '\\' : '/'
  const dirSuffix = 'baishou-data'
  const withSuffix = normalized.endsWith(separator)
    ? `${normalized}${dirSuffix}`
    : `${normalized}${separator}${dirSuffix}`

  return sanitizePersistedWorkspaceRoot(withSuffix)
}

export function defaultOnboardingStoragePath(): string {
  return defaultDesktopStorageRoot()
}
