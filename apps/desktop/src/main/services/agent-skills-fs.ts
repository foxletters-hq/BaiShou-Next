import { app } from 'electron'
import { constants as fsConstants } from 'fs'
import { createHash } from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  isValidSkillName,
  parseSkillMarkdown,
  serializeSkillMarkdown,
  type AgentSkill
} from '@baishou/shared'
import { resolveAppInstallRoot } from './agent-workspace-scratch.util'
import {
  resolveAgentsSkillsRoot,
  resolveAiSkillsRoot,
  resolveSkillDir,
  resolveSkillFile
} from './agent-skills.util'
import { mergeSkillsByName } from './agent-skills-merge.util'
import { broadcastSkillsChanged, invalidateAgentSkillsCache } from './agent-skills-state'

export async function resolveBundledSkillsRoot(): Promise<string> {
  // 打包运行环境下，严禁尝试向安装目录（Windows Program Files / macOS .app bundle）写入或迁移文件，
  // 避免 Windows 管理员安装后普通启动目录割裂，以及破坏 macOS 代码签名。
  // 打包环境下始终统一使用 userDataRoot/AI/skills 作为可写/可迁移目录。
  const installRoot = app.isPackaged
    ? null
    : resolveAppInstallRoot({
        isPackaged: app.isPackaged,
        exePath: app.getPath('exe'),
        appPath: app.getAppPath()
      })
  const preferred = resolveAiSkillsRoot({
    installRoot,
    userDataRoot: app.getPath('userData')
  })

  try {
    await fs.mkdir(preferred, { recursive: true })
    await fs.access(preferred, fsConstants.W_OK)
    return preferred
  } catch {
    const fallback = resolveAiSkillsRoot({
      installRoot: null,
      userDataRoot: app.getPath('userData')
    })
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}

const migratedHomeSkillRoots = new Set<string>()

/** 存储根下的用户技能目录；拿不到存储根时返回 null */
async function resolveSyncedUserSkillsRoot(): Promise<string | null> {
  try {
    const { pathService } = await import('../ipc/vault.ipc')
    const root = (await pathService.getRootDirectory()).trim()
    return root ? resolveAgentsSkillsRoot(root) : null
  } catch {
    return null
  }
}

/**
 * 把旧版 home/.agents/skills 一次性复制到存储根。
 * 用 userData 下的标记文件按目标根去重，避免用户删掉技能后又被旧副本复活。
 */
async function migrateLegacyHomeSkillsIfNeeded(targetRoot: string): Promise<void> {
  const homeRoot = resolveAgentsSkillsRoot(app.getPath('home'))
  if (path.resolve(homeRoot) === path.resolve(targetRoot)) return
  if (migratedHomeSkillRoots.has(targetRoot)) return

  const markerKey = createHash('sha1').update(targetRoot).digest('hex').slice(0, 12)
  const markerPath = path.join(app.getPath('userData'), `.agents-skills-migrated-${markerKey}`)
  try {
    await fs.access(markerPath)
    migratedHomeSkillRoots.add(targetRoot)
    return
  } catch {
    // first run for this storage root
  }

  let allOk = true
  try {
    await fs.mkdir(targetRoot, { recursive: true })
    const names = await fs.readdir(homeRoot).catch(() => [] as string[])
    for (const name of names) {
      if (!isValidSkillName(name)) continue
      const fromDir = resolveSkillDir(homeRoot, name)
      const fromFile = resolveSkillFile(homeRoot, name)
      if (!(await pathExists(fromFile))) continue
      const toDir = resolveSkillDir(targetRoot, name)
      if (await pathExists(toDir)) continue
      try {
        await fs.cp(fromDir, toDir, { recursive: true })
      } catch (error) {
        allOk = false
        console.warn('[agent-skills] failed to migrate home skill', name, error)
      }
    }
  } catch (error) {
    allOk = false
    console.warn('[agent-skills] failed to prepare synced skills root', error)
  }

  if (!allOk) return
  try {
    await fs.writeFile(markerPath, '1', 'utf8')
  } catch {
    // marker 写失败下次重试，不阻断技能读取
  }
  migratedHomeSkillRoots.add(targetRoot)
}

export async function resolveUserAgentsSkillsRoot(options?: { ensure?: boolean }): Promise<string> {
  const syncedRoot = await resolveSyncedUserSkillsRoot()
  const preferred = syncedRoot ?? resolveAgentsSkillsRoot(app.getPath('home'))
  const fallback = resolveAgentsSkillsRoot(app.getPath('userData'))

  if (syncedRoot) {
    try {
      await fs.mkdir(preferred, { recursive: true })
      await fs.access(preferred, fsConstants.W_OK)
      await migrateLegacyHomeSkillsIfNeeded(preferred)
      return preferred
    } catch (error) {
      console.warn('[agent-skills] synced user skills root unavailable, falling back', error)
    }
  }

  if (!options?.ensure) {
    try {
      await fs.access(preferred)
      return preferred
    } catch {
      try {
        await fs.access(fallback)
        return fallback
      } catch {
        return preferred
      }
    }
  }
  try {
    await fs.mkdir(preferred, { recursive: true })
    await fs.access(preferred, fsConstants.W_OK)
    return preferred
  } catch {
    await fs.mkdir(fallback, { recursive: true })
    return fallback
  }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export async function moveSkillDirectory(fromDir: string, toDir: string): Promise<void> {
  await fs.mkdir(path.dirname(toDir), { recursive: true })
  try {
    await fs.rename(fromDir, toDir)
    return
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ''
    if (code !== 'EXDEV' && code !== 'EEXIST' && code !== 'ENOTEMPTY') throw error
  }
  await fs.cp(fromDir, toDir, { recursive: true })
  await fs.rm(fromDir, { recursive: true, force: true })
}

export async function getSkillsRootMtimeMs(skillsRoot: string): Promise<number> {
  try {
    const st = await fs.stat(skillsRoot)
    return st.mtimeMs
  } catch {
    return 0
  }
}

export async function writeSkillFile(
  skillsRoot: string,
  input: { name: string; description: string; content: string; bundledHash?: string },
  source: AgentSkill['source'] = 'software'
): Promise<AgentSkill> {
  if (!isValidSkillName(input.name)) {
    throw new Error(`Invalid skill name: ${input.name}`)
  }
  const dir = resolveSkillDir(skillsRoot, input.name)
  const location = resolveSkillFile(skillsRoot, input.name)
  await fs.mkdir(dir, { recursive: true })
  const markdown = serializeSkillMarkdown(input)
  await fs.writeFile(location, markdown, 'utf-8')
  invalidateAgentSkillsCache()
  broadcastSkillsChanged()
  return {
    name: input.name,
    description: input.description.trim() || input.name,
    content: input.content,
    location,
    source,
    ...(input.bundledHash ? { bundledHash: input.bundledHash } : {})
  }
}

export async function listSkillFiles(
  skillsRoot: string,
  source: AgentSkill['source'] = 'software'
): Promise<AgentSkill[]> {
  let entries: string[] = []
  try {
    entries = await fs.readdir(skillsRoot)
  } catch {
    return []
  }

  const skills: AgentSkill[] = []
  for (const entry of entries) {
    if (!isValidSkillName(entry)) continue
    const location = resolveSkillFile(skillsRoot, entry)
    try {
      const markdown = await fs.readFile(location, 'utf-8')
      const parsed = parseSkillMarkdown(markdown, location, { fallbackName: entry })
      if (!parsed) continue
      skills.push({ ...parsed, name: entry, location, source })
    } catch {
      // skip unreadable
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

export async function listMergedSoftwareSkills(): Promise<AgentSkill[]> {
  const bundledRoot = await resolveBundledSkillsRoot()
  const userRoot = await resolveUserAgentsSkillsRoot()
  const [bundled, user] = await Promise.all([
    listSkillFiles(bundledRoot, 'software'),
    listSkillFiles(userRoot, 'user')
  ])
  return mergeSkillsByName(bundled, user)
}
