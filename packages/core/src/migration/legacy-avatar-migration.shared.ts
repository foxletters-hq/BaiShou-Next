import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import type { RawSqlExecutor } from './legacy-migration.shared'
import { discoverVaultNames } from './legacy-migration.shared'

export type LegacyAvatarImporter = (absoluteSourcePath: string, prefix: string) => Promise<string>

const IMAGE_FILE = /\.(jpe?g|png|gif|webp)$/i
/** 旧版伙伴头像文件名：{assistantId}.jpg，与 user_profile_service 用户头像命名区分 */
const FLUTTER_ASSISTANT_AVATAR_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\./i

/**
 * 旧版 Flutter 用户头像文件名（见 BaiShou user_profile_service.dart / data_archive_manager.dart）：
 * - Documents/avatars/avatar_{timestamp}.ext
 * - Documents/avatars/user_avatar.ext（归档导入）
 * - Documents/avatars/avatar_imported_{timestamp}.ext（配置 base64 恢复）
 * - BaiShou_Root/config/avatar.ext（全量归档导出）
 */
export function isFlutterLegacyUserAvatarFileName(name: string): boolean {
  if (!IMAGE_FILE.test(name)) return false
  if (FLUTTER_ASSISTANT_AVATAR_FILE.test(name)) return false
  if (name.startsWith('agent_avatar')) return false
  return (
    name.startsWith('avatar_') ||
    name.startsWith('user_avatar.') ||
    name.startsWith('avatar_imported_') ||
    name.startsWith('avatar.')
  )
}

function extractFlutterUserAvatarTimestamp(name: string): number {
  const match = name.match(/^avatar_(?:imported_)?(\d+)/)
  return match ? Number(match[1]) : 0
}

async function listImageFilesInDir(fileSystem: IFileSystem, dir: string): Promise<string[]> {
  if (!(await fileSystem.exists(dir))) return []
  try {
    const entries = await fileSystem.readdir(dir)
    return entries.filter((name) => IMAGE_FILE.test(name))
  } catch {
    return []
  }
}

async function listFlutterUserAvatarFilesInDir(
  fileSystem: IFileSystem,
  dir: string
): Promise<string[]> {
  const names = await listImageFilesInDir(fileSystem, dir)
  return names
    .filter(isFlutterLegacyUserAvatarFileName)
    .sort((a, b) => extractFlutterUserAvatarTimestamp(b) - extractFlutterUserAvatarTimestamp(a))
}

/** Next 版工作区内用户头像（非 Flutter 旧版主路径，仅作兜底） */
async function appendVaultUserAvatarCandidates(
  fileSystem: IFileSystem,
  sourceRoot: string,
  candidatePaths: string[]
): Promise<void> {
  const vaultNames = await discoverVaultNames(fileSystem, sourceRoot)
  for (const vaultName of vaultNames) {
    const userDir = path.join(sourceRoot, vaultName, 'Attachments', 'avatars', 'UserAvatars')
    for (const name of await listImageFilesInDir(fileSystem, userDir)) {
      if (name.startsWith('user_avatar')) {
        candidatePaths.push(path.join(userDir, name))
      }
    }
  }
}

function prioritizeUserAvatarCandidates(
  candidatePaths: string[],
  preferredBaseName?: string | null
): string[] {
  const seen = new Set<string>()
  const unique = candidatePaths.filter((p) => {
    if (seen.has(p)) return false
    seen.add(p)
    return true
  })

  return unique.sort((a, b) => {
    const baseA = a.split(/[/\\]/).pop() ?? ''
    const baseB = b.split(/[/\\]/).pop() ?? ''
    const score = (base: string, fullPath: string) => {
      if (preferredBaseName && base === preferredBaseName) return 0
      if (fullPath.replace(/\\/g, '/').includes('/config/') && base.startsWith('avatar.')) return 1
      if (base.startsWith('user_avatar.')) return 2
      if (base.startsWith('avatar_imported_')) return 3
      if (base.startsWith('avatar_')) return 4
      if (base.startsWith('user_avatar')) return 5
      return 99
    }
    return score(baseA, a) - score(baseB, b)
  })
}

export async function restoreLegacyAvatarsFromArchiveLayout(
  fileSystem: IFileSystem,
  sourceDir: string,
  importAvatar: LegacyAvatarImporter
): Promise<Record<string, string>> {
  const avatarMap: Record<string, string> = {}
  const legacyAvatarsDir = path.join(sourceDir, 'assistant_avatars')
  if (!(await fileSystem.exists(legacyAvatarsDir))) return avatarMap

  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(legacyAvatarsDir)
  } catch {
    return avatarMap
  }

  for (const name of entries) {
    const fullPath = path.join(legacyAvatarsDir, name)
    try {
      const stat = await fileSystem.stat(fullPath)
      if (!stat.isDirectory) {
        avatarMap[name] = await importAvatar(fullPath, 'agent_avatar')
      }
    } catch {
      // skip single file
    }
  }
  return avatarMap
}

export async function restoreLegacyAvatarsFromDocumentsDir(
  fileSystem: IFileSystem,
  avatarsDir: string,
  importAvatar: LegacyAvatarImporter
): Promise<Record<string, string>> {
  const avatarMap: Record<string, string> = {}
  if (!(await fileSystem.exists(avatarsDir))) return avatarMap

  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(avatarsDir)
  } catch {
    return avatarMap
  }

  for (const name of entries) {
    if (!FLUTTER_ASSISTANT_AVATAR_FILE.test(name) && !name.startsWith('agent_avatar')) continue
    const fullPath = path.join(avatarsDir, name)
    try {
      const stat = await fileSystem.stat(fullPath)
      if (!stat.isDirectory) {
        avatarMap[name] = await importAvatar(fullPath, 'agent_avatar')
      }
    } catch {
      // skip
    }
  }
  return avatarMap
}

export async function restoreUserAvatarFromConfigDir(
  fileSystem: IFileSystem,
  configDir: string,
  importAvatar: LegacyAvatarImporter
): Promise<string | null> {
  if (!(await fileSystem.exists(configDir))) return null

  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(configDir)
  } catch {
    return null
  }

  for (const name of entries) {
    if (!name.startsWith('avatar.')) continue
    const fullPath = path.join(configDir, name)
    return importAvatar(fullPath, 'user_avatar')
  }
  return null
}

export async function restoreUserAvatarFromSpPath(
  fileSystem: IFileSystem,
  userAvatarPath: string | undefined,
  importAvatar: LegacyAvatarImporter
): Promise<string | null> {
  if (!userAvatarPath?.trim()) return null
  if (!(await fileSystem.exists(userAvatarPath))) return null
  return importAvatar(userAvatarPath, 'user_avatar')
}

/**
 * 按旧版 Flutter 真实存储位置恢复用户头像。
 * SP 键 user_avatar_path → 绝对路径；文件在 app_flutter/avatars/，不在 BaiShou_Root 工作区内。
 */
export async function restoreLegacyUserAvatar(
  fileSystem: IFileSystem,
  options: {
    userAvatarPathFromPrefs?: string | null
    sourceRoot: string
    flutterDocumentsAvatarsDir?: string | null
    importAvatar: LegacyAvatarImporter
  }
): Promise<string | null> {
  const { userAvatarPathFromPrefs, sourceRoot, flutterDocumentsAvatarsDir, importAvatar } = options
  const candidatePaths: string[] = []

  const spPath = userAvatarPathFromPrefs?.trim()
  const spBaseName = spPath?.split(/[/\\]/).pop()

  if (spPath) {
    candidatePaths.push(spPath)
    if (spBaseName) {
      if (flutterDocumentsAvatarsDir) {
        candidatePaths.push(path.join(flutterDocumentsAvatarsDir, spBaseName))
      }
    }
  }

  const configDir = path.join(sourceRoot, 'config')
  if (await fileSystem.exists(configDir)) {
    try {
      const entries = await fileSystem.readdir(configDir)
      for (const name of entries) {
        if (name.startsWith('avatar.')) {
          candidatePaths.push(path.join(configDir, name))
        }
      }
    } catch {
      // ignore
    }
  }

  if (flutterDocumentsAvatarsDir && (await fileSystem.exists(flutterDocumentsAvatarsDir))) {
    for (const name of await listFlutterUserAvatarFilesInDir(fileSystem, flutterDocumentsAvatarsDir)) {
      candidatePaths.push(path.join(flutterDocumentsAvatarsDir, name))
    }
  }

  await appendVaultUserAvatarCandidates(fileSystem, sourceRoot, candidatePaths)

  const ordered = prioritizeUserAvatarCandidates(candidatePaths, spBaseName)
  const errors: string[] = []

  for (const candidate of ordered) {
    if (!(await fileSystem.exists(candidate))) continue
    const baseName = candidate.split(/[/\\]/).pop() ?? ''
    if (
      candidate.includes('/avatars/') &&
      !candidate.includes('/config/') &&
      !isFlutterLegacyUserAvatarFileName(baseName) &&
      !baseName.startsWith('user_avatar')
    ) {
      continue
    }
    try {
      return await importAvatar(candidate, 'user_avatar')
    } catch (error) {
      if (errors.length < 4) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join(' · '))
  }
  return null
}

export async function rectifyAssistantAvatarPaths(
  client: unknown,
  executeRawSql: RawSqlExecutor,
  avatarMap: Record<string, string>
): Promise<void> {
  if (Object.keys(avatarMap).length === 0) return

  const assistants = await executeRawSql(
    client,
    "SELECT id, avatar_path FROM agent_assistants WHERE avatar_path IS NOT NULL AND avatar_path != ''"
  )
  for (const row of assistants.rows) {
    const oldPath = String(row['avatar_path'] ?? '')
    const filename = oldPath.split(/[/\\]/).pop()
    if (!filename || !avatarMap[filename]) continue
    await executeRawSql(client, 'UPDATE agent_assistants SET avatar_path = ? WHERE id = ?', [
      avatarMap[filename],
      row['id']
    ])
  }
}

export function mergeAvatarMaps(...maps: Array<Record<string, string>>): Record<string, string> {
  return Object.assign({}, ...maps)
}

/** 将旧版 SQLite/文件系统中的 avatar_path 映射为新版相对路径 */
export function resolveLegacyAvatarPathInMap(
  oldPath: string | undefined | null,
  avatarMap: Record<string, string>
): string | undefined {
  if (oldPath == null || String(oldPath).trim() === '') return undefined
  const filename = String(oldPath).split(/[/\\]/).pop()
  if (!filename) return undefined
  return avatarMap[filename]
}

const ASSISTANT_AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'] as const

/**
 * 将旧版伙伴头像解析并导入为 `avatars/…` 相对路径。
 * 依次尝试：预构建映射 → SP/DB 绝对路径 → Documents/avatars → assistant_avatars 归档目录。
 */
export async function resolveImportedAssistantAvatarPath(
  fileSystem: IFileSystem,
  options: {
    legacyAvatarPath?: string | null
    assistantId?: string
    sourceRoot?: string
    avatarMap?: Record<string, string>
    flutterDocumentsAvatarsDir?: string | null
    importAvatar: LegacyAvatarImporter
  }
): Promise<string | undefined> {
  const {
    legacyAvatarPath,
    assistantId,
    sourceRoot,
    avatarMap = {},
    flutterDocumentsAvatarsDir,
    importAvatar
  } = options

  const mapped = resolveLegacyAvatarPathInMap(legacyAvatarPath, avatarMap)
  if (mapped?.startsWith('avatars/')) return mapped

  const candidates: string[] = []
  const pushCandidate = (candidate?: string | null) => {
    if (candidate?.trim()) candidates.push(candidate.trim())
  }

  pushCandidate(legacyAvatarPath)
  const basename = legacyAvatarPath?.split(/[/\\]/).pop()
  if (basename) {
    if (flutterDocumentsAvatarsDir) {
      pushCandidate(path.join(flutterDocumentsAvatarsDir, basename))
    }
    if (sourceRoot) {
      pushCandidate(path.join(sourceRoot, 'assistant_avatars', basename))
    }
  }

  if (assistantId) {
    for (const ext of ASSISTANT_AVATAR_EXTENSIONS) {
      if (flutterDocumentsAvatarsDir) {
        pushCandidate(path.join(flutterDocumentsAvatarsDir, `${assistantId}${ext}`))
      }
      if (sourceRoot) {
        pushCandidate(path.join(sourceRoot, 'assistant_avatars', `${assistantId}${ext}`))
      }
    }
  }

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue
    seen.add(candidate)
    if (!(await fileSystem.exists(candidate))) continue
    try {
      const imported = await importAvatar(candidate, 'agent_avatar')
      if (imported?.startsWith('avatars/')) return imported
    } catch {
      // try next candidate
    }
  }

  return mapped?.startsWith('avatars/') ? mapped : undefined
}
