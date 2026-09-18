import * as fs from 'fs/promises'
import * as path from 'path'
import {
  isValidSkillName,
  parseSkillMarkdown,
  skillToPromptShortcut,
  slugifySkillName,
  type AgentSkill,
  type AgentSkillWriteInput,
  type PromptShortcut
} from '@baishou/shared'
import { resolveSkillDir, resolveSkillFile, SKILL_FILE_NAME } from './agent-skills.util'
import {
  listMergedSoftwareSkills,
  listSkillFiles,
  resolveBundledSkillsRoot,
  resolveUserAgentsSkillsRoot,
  writeSkillFile
} from './agent-skills-fs'
import { broadcastSkillsChanged, invalidateAgentSkillsCache } from './agent-skills-state'
import { listAgentSkills } from './agent-skills-catalog'

export type { AgentSkillCatalogEntry } from './agent-skills.types'
export { invalidateAgentSkillsCache, resetAgentSkillsCacheForTests } from './agent-skills-state'
export {
  getAiSkillsRoot,
  getWritableUserSkillsRoot,
  listAgentSkills,
  listAgentSkillsCatalog
} from './agent-skills-catalog'
export {
  createWorkspaceAgentSkill,
  getWorkspaceAgentSkill,
  listAgentSkillsCatalogForWorkspace,
  listWorkspaceAgentSkills,
  updateWorkspaceAgentSkill
} from './agent-skills-workspace'

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
