import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { isLegacyAppRoot } from '../migration/legacy-migration.shared'

/** Next 版 ZIP 备份：manifest.json 含 formatVersion >= 1 */
export function isNextFormatArchiveManifest(manifest: unknown): boolean {
  if (!manifest || typeof manifest !== 'object') return false
  const formatVersion = (manifest as { formatVersion?: unknown }).formatVersion
  return typeof formatVersion === 'number' && formatVersion >= 1
}

const UNWRAP_SKIP_TOP_LEVEL = new Set(['__MACOSX', 'user-data'])

async function hasNextArchiveMarkers(fileSystem: IFileSystem, dir: string): Promise<boolean> {
  if (await fileSystem.exists(path.join(dir, 'vault_registry.json'))) return true
  if (await fileSystem.exists(path.join(dir, 'database', 'baishou_agent.db'))) return true
  return false
}

/**
 * 解压后若 ZIP 内只有一层包裹目录（常见于用户直接压缩 BaiShou_Root 文件夹），
 * 自动下钻到真正的工作区根目录。
 */
export async function resolveArchiveExtractRoot(
  fileSystem: IFileSystem,
  extractDir: string
): Promise<string> {
  if (await isLegacyAppRoot(fileSystem, extractDir)) return extractDir
  if (await hasNextArchiveMarkers(fileSystem, extractDir)) return extractDir

  let entries: string[]
  try {
    entries = await fileSystem.readdir(extractDir)
  } catch {
    return extractDir
  }

  const candidates = entries.filter(
    (name) => name && name !== '.' && name !== '..' && !UNWRAP_SKIP_TOP_LEVEL.has(name)
  )
  if (candidates.length !== 1) return extractDir

  const nested = path.join(extractDir, candidates[0]!)
  try {
    const stat = await fileSystem.stat(nested)
    if (!stat.isDirectory) return extractDir
  } catch {
    return extractDir
  }

  if (
    (await isLegacyAppRoot(fileSystem, nested)) ||
    (await hasNextArchiveMarkers(fileSystem, nested))
  ) {
    return nested
  }

  return extractDir
}

/**
 * 原版 Flutter 备份在 ZIP 内带有 `.baishou/agent.sqlite` 等 SQLite 文件。
 * 即使同时包含 Next 风格 manifest.json，也必须走 legacy 迁移而非整包覆盖。
 */
export async function hasFlutterLegacyDatabaseMarkers(
  fileSystem: IFileSystem,
  extractDir: string
): Promise<boolean> {
  if (await fileSystem.exists(path.join(extractDir, '.baishou', 'agent.sqlite'))) return true
  if (await fileSystem.exists(path.join(extractDir, '.baishou', 'vault_registry.json'))) {
    return true
  }

  try {
    const entries = await fileSystem.readdir(extractDir)
    for (const name of entries) {
      if (!name || name.startsWith('.')) continue
      const vaultAgentDb = path.join(extractDir, name, '.baishou', 'agent.sqlite')
      if (await fileSystem.exists(vaultAgentDb)) return true
    }
  } catch {
    // ignore unreadable directories
  }

  return false
}

/** 是否应按 Flutter 旧版物理备份包处理（无 Next manifest，但有 legacy 目录特征） */
export async function shouldImportAsFlutterLegacyArchive(
  fileSystem: IFileSystem,
  extractDir: string,
  manifest: unknown
): Promise<boolean> {
  if (await hasFlutterLegacyDatabaseMarkers(fileSystem, extractDir)) return true
  if (isNextFormatArchiveManifest(manifest)) return false
  return isLegacyAppRoot(fileSystem, extractDir)
}

/** 移动端归档导入：与桌面 shouldImportAsFlutterLegacyArchive 对齐 */
export async function shouldImportArchiveAsFlutterLegacy(
  fileSystem: IFileSystem,
  extractDir: string,
  hasValidManifest: boolean
): Promise<boolean> {
  if (await hasFlutterLegacyDatabaseMarkers(fileSystem, extractDir)) return true
  if (hasValidManifest) return false
  return isLegacyAppRoot(fileSystem, extractDir)
}
