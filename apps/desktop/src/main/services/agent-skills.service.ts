import { app } from 'electron'
import { constants as fsConstants } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  DEFAULT_AGENT_SKILLS,
  parseSkillMarkdown,
  promptShortcutToSkillInput,
  serializeSkillMarkdown,
  skillToPromptShortcut,
  slugifySkillName,
  isValidSkillName,
  type AgentSkill,
  type AgentSkillWriteInput,
  type PromptShortcut
} from '@baishou/shared'
import { PromptShortcutRepository, SettingsRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { resolveAppInstallRoot } from './agent-workspace-scratch.util'
import {
  PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY,
  resolveAiSkillsRoot,
  resolveSkillDir,
  resolveSkillFile,
  SKILL_FILE_NAME
} from './agent-skills.util'

/** 热路径 catalog：仅 name + description */
export type AgentSkillCatalogEntry = {
  name: string
  description: string
}

type CatalogCache = {
  skillsRoot: string
  mtimeMs: number
  entries: AgentSkillCatalogEntry[]
}

let catalogCache: CatalogCache | null = null
/** 进程内：迁移已完成（含 DB flag 已读为 true） */
let migrateDoneInProcess = false
/** 进程内：默认 skills 已 ensure 过（写盘后会清掉） */
let defaultsEnsuredInProcess = false

export function invalidateAgentSkillsCache(): void {
  catalogCache = null
}

/** 测试专用 */
export function resetAgentSkillsCacheForTests(): void {
  catalogCache = null
  migrateDoneInProcess = false
  defaultsEnsuredInProcess = false
}

async function resolveWritableSkillsRoot(): Promise<string> {
  const installRoot = resolveAppInstallRoot({
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

async function readMigrationFlag(): Promise<boolean> {
  try {
    const repo = new SettingsRepository(getAppDb())
    const value = await repo.get<boolean>(PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY)
    return value === true
  } catch {
    return false
  }
}

async function writeMigrationFlag(): Promise<void> {
  const repo = new SettingsRepository(getAppDb())
  await repo.set(PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY, true)
}

async function getSkillsRootMtimeMs(skillsRoot: string): Promise<number> {
  try {
    const st = await fs.stat(skillsRoot)
    return st.mtimeMs
  } catch {
    return 0
  }
}

async function writeSkillFile(
  skillsRoot: string,
  input: { name: string; description: string; content: string }
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
  return {
    name: input.name,
    description: input.description.trim() || input.name,
    content: input.content,
    location
  }
}

async function listSkillFiles(skillsRoot: string): Promise<AgentSkill[]> {
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
      const parsed = parseSkillMarkdown(markdown, location)
      if (!parsed) continue
      skills.push({ ...parsed, name: entry, location })
    } catch {
      // skip unreadable
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name))
  return skills
}

async function ensureDefaultSkills(skillsRoot: string, existing: AgentSkill[]): Promise<void> {
  if (defaultsEnsuredInProcess) return
  const names = new Set(existing.map((s) => s.name))
  for (const skill of DEFAULT_AGENT_SKILLS) {
    if (names.has(skill.name)) continue
    await writeSkillFile(skillsRoot, skill)
  }
  defaultsEnsuredInProcess = true
}

async function migrateShortcutsToSkills(skillsRoot: string, existing: AgentSkill[]): Promise<void> {
  if (migrateDoneInProcess) return
  if (await readMigrationFlag()) {
    migrateDoneInProcess = true
    return
  }

  const existingNames = new Set(existing.map((s) => s.name))
  let shortcuts: PromptShortcut[] = []
  try {
    const repo = new PromptShortcutRepository(getAppDb())
    shortcuts = await repo.getStoredShortcuts()
  } catch (e) {
    console.warn('[agent-skills] failed to read stored shortcuts for migration', e)
  }

  if (shortcuts.length === 0) {
    await writeMigrationFlag()
    migrateDoneInProcess = true
    return
  }

  for (const shortcut of shortcuts) {
    const input = promptShortcutToSkillInput(shortcut)
    let name = input.name
    if (!isValidSkillName(name)) {
      name = slugifySkillName(name)
    }
    if (existingNames.has(name)) continue
    await writeSkillFile(skillsRoot, { ...input, name })
    existingNames.add(name)
  }

  await writeMigrationFlag()
  migrateDoneInProcess = true
}

/**
 * 首次打开时做 migrate + ensureDefault；后续进程内短路，避免每轮 stream 三次全量扫描。
 * 返回确保后的 skills 列表（最多一次 listSkillFiles；若写盘则再扫一次）。
 */
async function ensureSkillsReady(skillsRoot: string): Promise<AgentSkill[]> {
  if (migrateDoneInProcess && defaultsEnsuredInProcess) {
    return listSkillFiles(skillsRoot)
  }

  let skills = await listSkillFiles(skillsRoot)
  if (!migrateDoneInProcess) {
    const beforeMtime = await getSkillsRootMtimeMs(skillsRoot)
    await migrateShortcutsToSkills(skillsRoot, skills)
    const afterMtime = await getSkillsRootMtimeMs(skillsRoot)
    if (afterMtime !== beforeMtime) {
      skills = await listSkillFiles(skillsRoot)
    }
  }
  if (!defaultsEnsuredInProcess) {
    const beforeMtime = await getSkillsRootMtimeMs(skillsRoot)
    await ensureDefaultSkills(skillsRoot, skills)
    const afterMtime = await getSkillsRootMtimeMs(skillsRoot)
    if (afterMtime !== beforeMtime) {
      skills = await listSkillFiles(skillsRoot)
    }
  }
  return skills
}

function toCatalogEntries(skills: AgentSkill[]): AgentSkillCatalogEntry[] {
  return skills.map((s) => ({
    name: s.name,
    description: s.description
  }))
}

export async function getAiSkillsRoot(): Promise<string> {
  return resolveWritableSkillsRoot()
}

/** 管理 UI / 全量内容：单次扫描 + migrate/defaults 短路 */
export async function listAgentSkills(): Promise<AgentSkill[]> {
  const skillsRoot = await resolveWritableSkillsRoot()
  return ensureSkillsReady(skillsRoot)
}

/**
 * 热路径 catalog（stream 注入）：进程内按目录 mtime 缓存 name+description。
 */
export async function listAgentSkillsCatalog(): Promise<AgentSkillCatalogEntry[]> {
  const skillsRoot = await resolveWritableSkillsRoot()
  const mtimeMs = await getSkillsRootMtimeMs(skillsRoot)
  if (
    catalogCache &&
    catalogCache.skillsRoot === skillsRoot &&
    catalogCache.mtimeMs === mtimeMs &&
    migrateDoneInProcess &&
    defaultsEnsuredInProcess
  ) {
    return catalogCache.entries
  }

  const skills = await ensureSkillsReady(skillsRoot)
  const entries = toCatalogEntries(skills)
  const freshMtime = await getSkillsRootMtimeMs(skillsRoot)
  catalogCache = { skillsRoot, mtimeMs: freshMtime, entries }
  return entries
}

/** 供 InputBar / 管理 UI 使用的 PromptShortcut 形态列表 */
export async function listAgentSkillsAsShortcuts(): Promise<PromptShortcut[]> {
  const skills = await listAgentSkills()
  return skills.map(skillToPromptShortcut)
}

export async function createAgentSkill(input: AgentSkillWriteInput): Promise<AgentSkill> {
  const skillsRoot = await resolveWritableSkillsRoot()
  const name = slugifySkillName(input.name)
  if (!isValidSkillName(name)) throw new Error(`Invalid skill name: ${input.name}`)
  const existing = await listSkillFiles(skillsRoot)
  if (existing.some((s) => s.name === name)) {
    throw new Error('DUPLICATE_SKILL_NAME')
  }
  return writeSkillFile(skillsRoot, {
    name,
    description: input.description || name,
    content: input.content
  })
}

export async function updateAgentSkill(input: AgentSkillWriteInput): Promise<AgentSkill> {
  const skillsRoot = await resolveWritableSkillsRoot()
  const previousName = input.previousName?.trim() || input.name
  const nextName = slugifySkillName(input.name)
  if (!isValidSkillName(nextName)) throw new Error(`Invalid skill name: ${input.name}`)

  const existing = await listSkillFiles(skillsRoot)
  if (!existing.some((s) => s.name === previousName)) {
    throw new Error(`Skill not found: ${previousName}`)
  }
  if (nextName !== previousName && existing.some((s) => s.name === nextName)) {
    throw new Error('DUPLICATE_SKILL_NAME')
  }

  const skill = await writeSkillFile(skillsRoot, {
    name: nextName,
    description: input.description || nextName,
    content: input.content
  })

  if (nextName !== previousName) {
    const oldDir = resolveSkillDir(skillsRoot, previousName)
    try {
      await fs.rm(oldDir, { recursive: true, force: true })
      invalidateAgentSkillsCache()
    } catch (e) {
      console.warn('[agent-skills] failed to remove old skill dir', oldDir, e)
    }
  }

  return skill
}

export async function removeAgentSkill(name: string): Promise<void> {
  const skillsRoot = await resolveWritableSkillsRoot()
  const skillName = name.trim()
  if (!isValidSkillName(skillName)) throw new Error(`Invalid skill name: ${name}`)
  const dir = resolveSkillDir(skillsRoot, skillName)
  const skillFile = path.join(dir, SKILL_FILE_NAME)
  try {
    await fs.access(skillFile)
  } catch {
    throw new Error(`Skill not found: ${skillName}`)
  }
  await fs.rm(dir, { recursive: true, force: true })
  invalidateAgentSkillsCache()
}

export async function getAgentSkill(name: string): Promise<AgentSkill | null> {
  const skillsRoot = await resolveWritableSkillsRoot()
  if (!isValidSkillName(name)) return null
  const location = resolveSkillFile(skillsRoot, name)
  try {
    const markdown = await fs.readFile(location, 'utf-8')
    const parsed = parseSkillMarkdown(markdown, location)
    return parsed ? { ...parsed, name, location } : null
  } catch {
    return null
  }
}
