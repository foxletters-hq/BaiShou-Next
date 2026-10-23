import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { LEGACY_SETTINGS_FILENAME, LEGACY_SETTINGS_MIGRATED_SUFFIX } from './settings-domain.util'

/** 仓内旧设置目录退役后缀：`<vault>/.baishou/settings` → `settings.migrated` */
export const VAULT_SETTINGS_DIR_MIGRATED_NAME = `settings${LEGACY_SETTINGS_MIGRATED_SUFFIX}`

const SKIP_ROOT_DIR_NAMES = new Set([
  '.baishou',
  '.snapshots',
  'snapshots',
  'node_modules',
  '.versions',
  'temp'
])

export interface MigrateVaultSettingsToGlobalResult {
  /** 是否从活跃仓把设置目录/遗留文件搬到了存储根 */
  movedFromActive: boolean
  /** 退役（重命名为 .migrated）的仓内 settings 目录数 */
  retiredSettingsDirCount: number
  /** 退役的仓内 settings.json 数 */
  retiredLegacyFileCount: number
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return Boolean(err && typeof err === 'object' && 'code' in err)
}

async function listJsonSettingsFiles(dir: string, fileSystem: IFileSystem): Promise<string[]> {
  try {
    const entries = await fileSystem.readdir(dir)
    return entries.filter(
      (name) =>
        name.endsWith('.json') &&
        !name.endsWith('.tmp') &&
        !name.endsWith(LEGACY_SETTINGS_MIGRATED_SUFFIX)
    )
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') return []
    throw err
  }
}

async function hasSettingsContent(dir: string, fileSystem: IFileSystem): Promise<boolean> {
  return (await listJsonSettingsFiles(dir, fileSystem)).length > 0
}

async function ensureParentDir(dir: string, fileSystem: IFileSystem): Promise<void> {
  await fileSystem.mkdir(path.dirname(dir), { recursive: true })
}

async function removeEmptyDirIfPresent(dir: string, fileSystem: IFileSystem): Promise<void> {
  try {
    const entries = await fileSystem.readdir(dir)
    if (entries.length === 0) {
      await fileSystem.rm(dir, { recursive: true, force: true })
    }
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') return
    throw err
  }
}

async function renameAvoidingCollision(
  from: string,
  preferredTo: string,
  fileSystem: IFileSystem
): Promise<void> {
  if (!(await fileSystem.exists(from))) return
  if (!(await fileSystem.exists(preferredTo))) {
    await fileSystem.rename(from, preferredTo)
    return
  }
  // 已有 .migrated：再留一份带时间戳，避免覆盖用户备份
  const stamped = `${preferredTo}.${Date.now()}`
  await fileSystem.rename(from, stamped)
}

function normalizePathKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * V1.5：把设置从 `<Vault>/.baishou/settings` 搬到存储根 `.baishou/settings`。
 *
 * - 根级尚无设置内容时，优先搬活跃仓
 * - 各仓残留 `settings/` 重命名为 `settings.migrated`
 * - 仓内遗留 `settings.json` 同步退役为 `.migrated`
 * - 幂等：已迁移后再次调用为空操作
 */
export async function migrateVaultSettingsToGlobal(options: {
  fileSystem: IFileSystem
  rootDirectory: string
  globalSettingsDirectory: string
  activeVaultPath: string | null
}): Promise<MigrateVaultSettingsToGlobalResult> {
  const { fileSystem, rootDirectory, globalSettingsDirectory, activeVaultPath } = options
  const result: MigrateVaultSettingsToGlobalResult = {
    movedFromActive: false,
    retiredSettingsDirCount: 0,
    retiredLegacyFileCount: 0
  }

  const normalizedActive = activeVaultPath ? normalizePathKey(activeVaultPath) : null

  let vaultDirNames: string[] = []
  try {
    vaultDirNames = await fileSystem.readdir(rootDirectory)
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') return result
    throw err
  }

  const vaultDirs: Array<{ name: string; abs: string }> = []
  for (const name of vaultDirNames) {
    if (SKIP_ROOT_DIR_NAMES.has(name) || name.startsWith('.')) continue
    const abs = path.join(rootDirectory, name)
    try {
      const st = await fileSystem.stat(abs)
      if (!st.isDirectory) continue
    } catch {
      continue
    }
    vaultDirs.push({ name, abs })
  }

  const globalHasContent = await hasSettingsContent(globalSettingsDirectory, fileSystem)
  const globalLegacyPath = path.join(
    path.dirname(globalSettingsDirectory),
    LEGACY_SETTINGS_FILENAME
  )
  const globalHasLegacy =
    !globalHasContent && (await fileSystem.exists(globalLegacyPath).catch(() => false))

  if (!globalHasContent && !globalHasLegacy && normalizedActive) {
    const activeVault = vaultDirs.find((v) => normalizePathKey(v.abs) === normalizedActive)
    if (activeVault) {
      const activeSys = path.join(activeVault.abs, '.baishou')
      const activeSettingsDir = path.join(activeSys, 'settings')
      const activeLegacy = path.join(activeSys, LEGACY_SETTINGS_FILENAME)

      if (await hasSettingsContent(activeSettingsDir, fileSystem)) {
        await ensureParentDir(globalSettingsDirectory, fileSystem)
        await removeEmptyDirIfPresent(globalSettingsDirectory, fileSystem)
        if (await fileSystem.exists(globalSettingsDirectory)) {
          // 非空但无 json（异常态）：不覆盖
        } else {
          await fileSystem.rename(activeSettingsDir, globalSettingsDirectory)
          result.movedFromActive = true
        }
      } else if (await fileSystem.exists(activeLegacy)) {
        await ensureParentDir(globalSettingsDirectory, fileSystem)
        if (!(await fileSystem.exists(globalLegacyPath))) {
          await fileSystem.rename(activeLegacy, globalLegacyPath)
          result.movedFromActive = true
        }
      }
    }
  }

  for (const vault of vaultDirs) {
    const sysDir = path.join(vault.abs, '.baishou')
    const settingsDir = path.join(sysDir, 'settings')
    const migratedDir = path.join(sysDir, VAULT_SETTINGS_DIR_MIGRATED_NAME)
    const legacyFile = path.join(sysDir, LEGACY_SETTINGS_FILENAME)
    const legacyMigrated = legacyFile + LEGACY_SETTINGS_MIGRATED_SUFFIX

    if (await fileSystem.exists(settingsDir)) {
      // 空目录直接删，避免无意义的 .migrated
      const hasContent = await hasSettingsContent(settingsDir, fileSystem)
      if (!hasContent) {
        try {
          const entries = await fileSystem.readdir(settingsDir)
          if (entries.length === 0) {
            await fileSystem.rm(settingsDir, { recursive: true, force: true })
          } else {
            await renameAvoidingCollision(settingsDir, migratedDir, fileSystem)
            result.retiredSettingsDirCount += 1
          }
        } catch (err) {
          if (!(isErrnoException(err) && err.code === 'ENOENT')) throw err
        }
      } else {
        await renameAvoidingCollision(settingsDir, migratedDir, fileSystem)
        result.retiredSettingsDirCount += 1
      }
    }

    if (await fileSystem.exists(legacyFile)) {
      await renameAvoidingCollision(legacyFile, legacyMigrated, fileSystem)
      result.retiredLegacyFileCount += 1
    }
  }

  return result
}
