import { app, BrowserWindow } from 'electron'
import { constants as fsConstants } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  DEFAULT_AGENT_SKILLS,
  isHiddenBundledSoftwareSkill,
  LEGACY_WRITER_SKILL_NAME,
  RETIRED_OFFICIAL_SKILL_NAMES,
  parseSkillMarkdown,
  planOfficialSkillRelocations,
  promptShortcutToSkillInput,
  serializeSkillMarkdown,
  skillToPromptShortcut,
  slugifySkillName,
  isValidSkillName,
  mergeSkillCatalogEntries,
  type AgentSkill,
  type AgentSkillWriteInput,
  type PromptShortcut
} from '@baishou/shared'
import { PromptShortcutRepository, SettingsRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { resolveAppInstallRoot } from './agent-workspace-scratch.util'
import { listAgentWorkspaces } from './agent-workspace-registry.store'
import { normalizeWorkspaceFolderKey } from './agent-workspace-registry.util'
import { listWorkspaceSkillsFromFolder } from './workspace-skills.util'
import {
  LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY,
  NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY,
  RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY,
  PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY,
  resolveAgentsSkillsRoot,
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
  bundledRoot: string
  userRoot: string
  bundledMtimeMs: number
  userMtimeMs: number
  entries: AgentSkillCatalogEntry[]
}

let catalogCache: CatalogCache | null = null
/** 进程内：迁移已完成（含 DB flag 已读为 true） */
let migrateDoneInProcess = false
/** 进程内：非官方技能已从 AI/skills 迁到 `.agents/skills` */
let relocateDoneInProcess = false
/** 进程内：旧官方 writer 目录已删除 */
let removeWriterDoneInProcess = false
/** 进程内：已退役官方技能已从 AI/skills 删除 */
let removeRetiredOfficialDoneInProcess = false
/** 进程内：默认 skills 已 ensure 过（写盘后会清掉） */
let defaultsEnsuredInProcess = false

export function invalidateAgentSkillsCache(): void {
  catalogCache = null
}

function broadcastSkillsChanged(): void {
  try {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('skills:changed')
    }
  } catch {
    // 测试环境或尚无窗口
  }
}

/** 测试专用 */
export function resetAgentSkillsCacheForTests(): void {
  catalogCache = null
  migrateDoneInProcess = false
  relocateDoneInProcess = false
  removeWriterDoneInProcess = false
  removeRetiredOfficialDoneInProcess = false
  defaultsEnsuredInProcess = false
}

async function resolveBundledSkillsRoot(): Promise<string> {
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

async function resolveUserAgentsSkillsRoot(options?: { ensure?: boolean }): Promise<string> {
  const preferred = resolveAgentsSkillsRoot(app.getPath('home'))
  const fallback = resolveAgentsSkillsRoot(app.getPath('userData'))
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

function mergeSkillsByName(base: AgentSkill[], overlay: AgentSkill[]): AgentSkill[] {
  const map = new Map<string, AgentSkill>()
  for (const item of base) {
    if (item.name) map.set(item.name, item)
  }
  for (const item of overlay) {
    if (item.name) map.set(item.name, item)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
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

async function readRelocateFlag(): Promise<boolean> {
  try {
    const repo = new SettingsRepository(getAppDb())
    const value = await repo.get<boolean>(NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY)
    return value === true
  } catch {
    return false
  }
}

async function writeRelocateFlag(): Promise<void> {
  const repo = new SettingsRepository(getAppDb())
  await repo.set(NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY, true)
}

async function readRemoveWriterFlag(): Promise<boolean> {
  try {
    const repo = new SettingsRepository(getAppDb())
    const value = await repo.get<boolean>(LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY)
    return value === true
  } catch {
    return false
  }
}

async function writeRemoveWriterFlag(): Promise<void> {
  const repo = new SettingsRepository(getAppDb())
  await repo.set(LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY, true)
}

async function readRemoveRetiredOfficialFlag(): Promise<boolean> {
  try {
    const repo = new SettingsRepository(getAppDb())
    const value = await repo.get<boolean>(RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY)
    return value === true
  } catch {
    return false
  }
}

async function writeRemoveRetiredOfficialFlag(): Promise<void> {
  const repo = new SettingsRepository(getAppDb())
  await repo.set(RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY, true)
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function moveSkillDirectory(fromDir: string, toDir: string): Promise<void> {
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
  input: { name: string; description: string; content: string },
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
    source
  }
}

async function listSkillFiles(
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

async function ensureDefaultSkills(skillsRoot: string, existing: AgentSkill[]): Promise<void> {
  if (defaultsEnsuredInProcess) return
  const byName = new Map(existing.map((skill) => [skill.name, skill]))
  for (const skill of DEFAULT_AGENT_SKILLS) {
    const current = byName.get(skill.name)
    if (!current) {
      await writeSkillFile(skillsRoot, skill)
      continue
    }
    if (current.description !== skill.description) {
      await writeSkillFile(skillsRoot, {
        name: skill.name,
        description: skill.description,
        content: current.content || skill.content
      })
    }
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
    await writeSkillFile(skillsRoot, { ...input, name }, 'user')
    existingNames.add(name)
  }

  await writeMigrationFlag()
  migrateDoneInProcess = true
}

async function relocateNonOfficialSkillsToUserAgents(bundledRoot: string): Promise<void> {
  if (relocateDoneInProcess) return
  if (await readRelocateFlag()) {
    relocateDoneInProcess = true
    return
  }

  const userRoot = await resolveUserAgentsSkillsRoot({ ensure: true })
  let bundledNames: string[] = []
  try {
    bundledNames = await fs.readdir(bundledRoot)
  } catch {
    await writeRelocateFlag()
    relocateDoneInProcess = true
    return
  }

  const destExisting = new Set<string>()
  for (const name of bundledNames) {
    if (await pathExists(resolveSkillFile(userRoot, name))) {
      destExisting.add(name)
    }
  }

  let changed = false
  for (const { name, action } of planOfficialSkillRelocations(bundledNames, destExisting)) {
    const fromDir = resolveSkillDir(bundledRoot, name)
    const fromFile = resolveSkillFile(bundledRoot, name)
    if (!(await pathExists(fromFile))) continue
    const toDir = resolveSkillDir(userRoot, name)
    try {
      if (action === 'remove-official') {
        await fs.rm(fromDir, { recursive: true, force: true })
      } else {
        await moveSkillDirectory(fromDir, toDir)
      }
      changed = true
    } catch (error) {
      console.warn('[agent-skills] failed to relocate official skill to user agents', name, error)
    }
  }

  if (changed) {
    invalidateAgentSkillsCache()
    broadcastSkillsChanged()
  }
  await writeRelocateFlag()
  relocateDoneInProcess = true
}

async function removeLegacyWriterSkillDirs(): Promise<void> {
  if (removeWriterDoneInProcess) return
  if (await readRemoveWriterFlag()) {
    removeWriterDoneInProcess = true
    return
  }

  const bundledRoot = await resolveBundledSkillsRoot()
  const userRoot = await resolveUserAgentsSkillsRoot()
  let changed = false
  for (const root of [bundledRoot, userRoot]) {
    const dir = resolveSkillDir(root, LEGACY_WRITER_SKILL_NAME)
    if (!(await pathExists(dir))) continue
    try {
      await fs.rm(dir, { recursive: true, force: true })
      changed = true
    } catch (error) {
      console.warn('[agent-skills] failed to remove legacy writer skill', dir, error)
    }
  }

  if (changed) {
    invalidateAgentSkillsCache()
    broadcastSkillsChanged()
  }
  await writeRemoveWriterFlag()
  removeWriterDoneInProcess = true
}

async function removeRetiredOfficialSkillDirs(): Promise<void> {
  if (removeRetiredOfficialDoneInProcess) return
  if (await readRemoveRetiredOfficialFlag()) {
    removeRetiredOfficialDoneInProcess = true
    return
  }

  const bundledRoot = await resolveBundledSkillsRoot()
  let changed = false
  for (const name of RETIRED_OFFICIAL_SKILL_NAMES) {
    const dir = resolveSkillDir(bundledRoot, name)
    if (!(await pathExists(dir))) continue
    try {
      await fs.rm(dir, { recursive: true, force: true })
      changed = true
    } catch (error) {
      console.warn('[agent-skills] failed to remove retired official skill', dir, error)
    }
  }

  if (changed) {
    invalidateAgentSkillsCache()
    broadcastSkillsChanged()
  }
  await writeRemoveRetiredOfficialFlag()
  removeRetiredOfficialDoneInProcess = true
}

/**
 * 首次打开时做 migrate + 把误入官方目录的用户技能迁走 + 删除旧 writer / 退役官方技能 + ensureDefault；
 * 后续进程内短路，避免每轮 stream 三次全量扫描。
 * 官方技能在 AI/skills；用户快捷指令与自定义技能在 `.agents/skills`。
 */
async function ensureSkillsReady(): Promise<AgentSkill[]> {
  const bundledRoot = await resolveBundledSkillsRoot()
  if (
    migrateDoneInProcess &&
    relocateDoneInProcess &&
    removeWriterDoneInProcess &&
    removeRetiredOfficialDoneInProcess &&
    defaultsEnsuredInProcess
  ) {
    return listMergedSoftwareSkills()
  }

  let bundledSkills = await listSkillFiles(bundledRoot, 'software')
  if (!migrateDoneInProcess) {
    const userRoot = await resolveUserAgentsSkillsRoot()
    const userSkills = await listSkillFiles(userRoot, 'user')
    await migrateShortcutsToSkills(userRoot, userSkills)
  }
  if (!relocateDoneInProcess) {
    await relocateNonOfficialSkillsToUserAgents(bundledRoot)
    bundledSkills = await listSkillFiles(bundledRoot, 'software')
  }
  if (!removeWriterDoneInProcess) {
    await removeLegacyWriterSkillDirs()
    bundledSkills = await listSkillFiles(bundledRoot, 'software')
  }
  if (!removeRetiredOfficialDoneInProcess) {
    await removeRetiredOfficialSkillDirs()
    bundledSkills = await listSkillFiles(bundledRoot, 'software')
  }
  if (!defaultsEnsuredInProcess) {
    const beforeMtime = await getSkillsRootMtimeMs(bundledRoot)
    await ensureDefaultSkills(bundledRoot, bundledSkills)
    const afterMtime = await getSkillsRootMtimeMs(bundledRoot)
    if (afterMtime !== beforeMtime) {
      bundledSkills = await listSkillFiles(bundledRoot, 'software')
    }
  }
  return listMergedSoftwareSkills()
}

async function listMergedSoftwareSkills(): Promise<AgentSkill[]> {
  const bundledRoot = await resolveBundledSkillsRoot()
  const userRoot = await resolveUserAgentsSkillsRoot()
  const [bundled, user] = await Promise.all([
    listSkillFiles(bundledRoot, 'software'),
    listSkillFiles(userRoot, 'user')
  ])
  return mergeSkillsByName(bundled, user)
}

function toCatalogEntries(skills: AgentSkill[]): AgentSkillCatalogEntry[] {
  return skills.map((s) => ({
    name: s.name,
    description: s.description
  }))
}

function omitBundledTemplateSkills(skills: AgentSkill[]): AgentSkill[] {
  return skills.filter((skill) => !isHiddenBundledSoftwareSkill(skill))
}

export async function getAiSkillsRoot(): Promise<string> {
  return resolveBundledSkillsRoot()
}

export async function getWritableUserSkillsRoot(): Promise<string> {
  return resolveUserAgentsSkillsRoot()
}

export async function listWorkspaceAgentSkills(folderRoot: string): Promise<AgentSkill[]> {
  const resolved = await resolveRegisteredWorkspaceRoot(folderRoot)
  if (!resolved) return []
  return listWorkspaceSkillsFromFolder(resolved)
}

async function resolveRegisteredWorkspaceRoot(folderRoot: string): Promise<string | null> {
  const resolved = folderRoot.trim()
  if (!resolved) return null
  const key = normalizeWorkspaceFolderKey(resolved)
  const workspaces = await listAgentWorkspaces()
  const matched = workspaces.some((item) => normalizeWorkspaceFolderKey(item.folderRoot) === key)
  return matched ? resolved : null
}

export async function createWorkspaceAgentSkill(
  folderRoot: string,
  input: AgentSkillWriteInput
): Promise<AgentSkill> {
  const resolved = await resolveRegisteredWorkspaceRoot(folderRoot)
  if (!resolved) throw new Error('Workspace not found')
  const skillsRoot = resolveAgentsSkillsRoot(resolved)
  const name = slugifySkillName(input.name)
  if (!isValidSkillName(name)) throw new Error(`Invalid skill name: ${input.name}`)
  const existing = await listSkillFiles(skillsRoot, 'workspace')
  if (existing.some((s) => s.name === name)) {
    throw new Error('DUPLICATE_SKILL_NAME')
  }
  return writeSkillFile(
    skillsRoot,
    {
      name,
      description: input.description || name,
      content: input.content
    },
    'workspace'
  )
}

export async function updateWorkspaceAgentSkill(
  folderRoot: string,
  input: AgentSkillWriteInput
): Promise<AgentSkill> {
  const resolved = await resolveRegisteredWorkspaceRoot(folderRoot)
  if (!resolved) throw new Error('Workspace not found')
  const skillsRoot = resolveAgentsSkillsRoot(resolved)
  const previousName = input.previousName?.trim() || input.name
  const nextName = slugifySkillName(input.name)
  if (!isValidSkillName(nextName)) throw new Error(`Invalid skill name: ${input.name}`)

  const listed = await listWorkspaceSkillsFromFolder(resolved)
  if (!listed.some((s) => s.name === previousName)) {
    throw new Error(`Skill not found: ${previousName}`)
  }
  const agentsExisting = await listSkillFiles(skillsRoot, 'workspace')
  if (nextName !== previousName && listed.some((s) => s.name === nextName)) {
    throw new Error('DUPLICATE_SKILL_NAME')
  }

  const skill = await writeSkillFile(
    skillsRoot,
    {
      name: nextName,
      description: input.description || nextName,
      content: input.content
    },
    'workspace'
  )

  if (nextName !== previousName && agentsExisting.some((s) => s.name === previousName)) {
    const oldDir = resolveSkillDir(skillsRoot, previousName)
    try {
      await fs.rm(oldDir, { recursive: true, force: true })
    } catch (e) {
      console.warn('[agent-skills] failed to remove old workspace skill dir', oldDir, e)
    }
  }

  return skill
}

export async function getWorkspaceAgentSkill(
  folderRoot: string,
  name: string
): Promise<AgentSkill | null> {
  const resolved = await resolveRegisteredWorkspaceRoot(folderRoot)
  if (!resolved || !isValidSkillName(name)) return null
  const listed = await listWorkspaceSkillsFromFolder(resolved)
  return listed.find((item) => item.name === name) ?? null
}

export async function listAgentSkillsCatalogForWorkspace(
  folderRoot: string
): Promise<AgentSkillCatalogEntry[]> {
  const [software, workspace] = await Promise.all([
    listAgentSkillsCatalog(),
    listWorkspaceSkillsFromFolder(folderRoot.trim())
  ])
  return mergeSkillCatalogEntries(software, workspace)
}

/** 管理 UI / 全量内容：内置 AI/skills + 用户 `.agents/skills` */
export async function listAgentSkills(): Promise<AgentSkill[]> {
  return omitBundledTemplateSkills(await ensureSkillsReady())
}

/**
 * 热路径 catalog（stream 注入）：进程内按目录 mtime 缓存 name+description。
 */
export async function listAgentSkillsCatalog(): Promise<AgentSkillCatalogEntry[]> {
  const bundledRoot = await resolveBundledSkillsRoot()
  const userRoot = await resolveUserAgentsSkillsRoot()
  const bundledMtimeMs = await getSkillsRootMtimeMs(bundledRoot)
  const userMtimeMs = await getSkillsRootMtimeMs(userRoot)
  if (
    catalogCache &&
    catalogCache.bundledRoot === bundledRoot &&
    catalogCache.userRoot === userRoot &&
    catalogCache.bundledMtimeMs === bundledMtimeMs &&
    catalogCache.userMtimeMs === userMtimeMs &&
    migrateDoneInProcess &&
    relocateDoneInProcess &&
    removeWriterDoneInProcess &&
    removeRetiredOfficialDoneInProcess &&
    defaultsEnsuredInProcess
  ) {
    return catalogCache.entries
  }

  const skills = omitBundledTemplateSkills(await ensureSkillsReady())
  const entries = toCatalogEntries(skills)
  catalogCache = {
    bundledRoot,
    userRoot,
    bundledMtimeMs: await getSkillsRootMtimeMs(bundledRoot),
    userMtimeMs: await getSkillsRootMtimeMs(userRoot),
    entries
  }
  return entries
}

/** 供 InputBar / 管理 UI 使用的 PromptShortcut 形态列表 */
export async function listAgentSkillsAsShortcuts(): Promise<PromptShortcut[]> {
  return (await listAgentSkills()).map(skillToPromptShortcut)
}

export async function createAgentSkill(input: AgentSkillWriteInput): Promise<AgentSkill> {
  const skillsRoot = await resolveUserAgentsSkillsRoot({ ensure: true })
  const name = slugifySkillName(input.name)
  if (!isValidSkillName(name)) throw new Error(`Invalid skill name: ${input.name}`)
  const existing = await listSkillFiles(skillsRoot, 'user')
  if (existing.some((s) => s.name === name)) {
    throw new Error('DUPLICATE_SKILL_NAME')
  }
  return writeSkillFile(
    skillsRoot,
    {
      name,
      description: input.description || name,
      content: input.content
    },
    'user'
  )
}

export async function updateAgentSkill(input: AgentSkillWriteInput): Promise<AgentSkill> {
  const userRoot = await resolveUserAgentsSkillsRoot({ ensure: true })
  const previousName = input.previousName?.trim() || input.name
  const nextName = slugifySkillName(input.name)
  if (!isValidSkillName(nextName)) throw new Error(`Invalid skill name: ${input.name}`)

  const merged = await listMergedSoftwareSkills()
  const userExisting = await listSkillFiles(userRoot, 'user')
  if (!merged.some((s) => s.name === previousName)) {
    throw new Error(`Skill not found: ${previousName}`)
  }
  if (nextName !== previousName && merged.some((s) => s.name === nextName)) {
    throw new Error('DUPLICATE_SKILL_NAME')
  }

  const skill = await writeSkillFile(
    userRoot,
    {
      name: nextName,
      description: input.description || nextName,
      content: input.content
    },
    'user'
  )

  if (nextName !== previousName && userExisting.some((s) => s.name === previousName)) {
    const oldDir = resolveSkillDir(userRoot, previousName)
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
  const skillsRoot = await resolveUserAgentsSkillsRoot()
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
  broadcastSkillsChanged()
}

export async function getAgentSkill(name: string): Promise<AgentSkill | null> {
  if (!isValidSkillName(name)) return null
  const userRoot = await resolveUserAgentsSkillsRoot()
  const bundledRoot = await resolveBundledSkillsRoot()
  const roots: Array<{ root: string; source: AgentSkill['source'] }> = [
    { root: userRoot, source: 'user' },
    { root: bundledRoot, source: 'software' }
  ]
  for (const { root, source } of roots) {
    const location = resolveSkillFile(root, name)
    try {
      const markdown = await fs.readFile(location, 'utf-8')
      const parsed = parseSkillMarkdown(markdown, location, { fallbackName: name })
      if (parsed) return { ...parsed, name, location, source }
    } catch {
      // try next root
    }
  }
  return null
}
