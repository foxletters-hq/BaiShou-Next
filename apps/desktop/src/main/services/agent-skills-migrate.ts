import * as fs from 'fs/promises'
import {
  DEFAULT_AGENT_SKILLS,
  LEGACY_WRITER_SKILL_NAME,
  RETIRED_OFFICIAL_SKILL_NAMES,
  isValidSkillName,
  planOfficialSkillRelocations,
  promptShortcutToSkillInput,
  slugifySkillName,
  type AgentSkill,
  type PromptShortcut
} from '@baishou/shared'
import { PromptShortcutRepository, SettingsRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'
import {
  LEGACY_WRITER_SKILL_REMOVED_FLAG_KEY,
  NON_OFFICIAL_SKILLS_RELOCATED_FLAG_KEY,
  RETIRED_OFFICIAL_SKILLS_REMOVED_FLAG_KEY,
  PROMPT_SHORTCUTS_MIGRATED_FLAG_KEY,
  resolveSkillDir,
  resolveSkillFile
} from './agent-skills.util'
import {
  getSkillsRootMtimeMs,
  listMergedSoftwareSkills,
  listSkillFiles,
  moveSkillDirectory,
  pathExists,
  resolveBundledSkillsRoot,
  resolveUserAgentsSkillsRoot,
  writeSkillFile
} from './agent-skills-fs'
import {
  broadcastSkillsChanged,
  defaultsEnsuredInProcess,
  invalidateAgentSkillsCache,
  migrateDoneInProcess,
  relocateDoneInProcess,
  removeRetiredOfficialDoneInProcess,
  removeWriterDoneInProcess,
  setDefaultsEnsuredInProcess,
  setMigrateDoneInProcess,
  setRelocateDoneInProcess,
  setRemoveRetiredOfficialDoneInProcess,
  setRemoveWriterDoneInProcess
} from './agent-skills-state'

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
  setDefaultsEnsuredInProcess(true)
}

async function migrateShortcutsToSkills(skillsRoot: string, existing: AgentSkill[]): Promise<void> {
  if (migrateDoneInProcess) return
  if (await readMigrationFlag()) {
    setMigrateDoneInProcess(true)
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
    setMigrateDoneInProcess(true)
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
  setMigrateDoneInProcess(true)
}

async function relocateNonOfficialSkillsToUserAgents(bundledRoot: string): Promise<void> {
  if (relocateDoneInProcess) return
  if (await readRelocateFlag()) {
    setRelocateDoneInProcess(true)
    return
  }

  const userRoot = await resolveUserAgentsSkillsRoot({ ensure: true })
  let bundledNames: string[] = []
  try {
    bundledNames = await fs.readdir(bundledRoot)
  } catch {
    await writeRelocateFlag()
    setRelocateDoneInProcess(true)
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
  setRelocateDoneInProcess(true)
}

async function removeLegacyWriterSkillDirs(): Promise<void> {
  if (removeWriterDoneInProcess) return
  if (await readRemoveWriterFlag()) {
    setRemoveWriterDoneInProcess(true)
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
  setRemoveWriterDoneInProcess(true)
}

async function removeRetiredOfficialSkillDirs(): Promise<void> {
  if (removeRetiredOfficialDoneInProcess) return
  if (await readRemoveRetiredOfficialFlag()) {
    setRemoveRetiredOfficialDoneInProcess(true)
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
  setRemoveRetiredOfficialDoneInProcess(true)
}

/**
 * 首次打开时做 migrate + 把误入官方目录的用户技能迁走 + 删除旧 writer / 退役官方技能 + ensureDefault；
 * 后续进程内短路，避免每轮 stream 三次全量扫描。
 * 官方技能在 AI/skills；用户快捷指令与自定义技能在 `.agents/skills`。
 */
export async function ensureSkillsReady(): Promise<AgentSkill[]> {
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
