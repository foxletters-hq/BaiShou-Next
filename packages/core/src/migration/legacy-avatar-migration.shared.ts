import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import type { RawSqlExecutor } from './legacy-migration.shared'

export type LegacyAvatarImporter = (
  absoluteSourcePath: string,
  prefix: string
) => Promise<string>

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

export function mergeAvatarMaps(
  ...maps: Array<Record<string, string>>
): Record<string, string> {
  return Object.assign({}, ...maps)
}
