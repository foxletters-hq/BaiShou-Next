import * as fs from 'fs/promises'
import {
  isValidSkillName,
  mergeSkillCatalogEntries,
  slugifySkillName,
  type AgentSkill,
  type AgentSkillWriteInput
} from '@baishou/shared'
import { listAgentWorkspaces } from './agent-workspace-registry.store'
import { normalizeWorkspaceFolderKey } from './agent-workspace-registry.util'
import { listWorkspaceSkillsFromFolder } from './workspace-skills.util'
import { resolveAgentsSkillsRoot, resolveSkillDir } from './agent-skills.util'
import { listSkillFiles, writeSkillFile } from './agent-skills-fs'
import type { AgentSkillCatalogEntry } from './agent-skills.types'
import { listAgentSkillsCatalog } from './agent-skills-catalog'

async function resolveRegisteredWorkspaceRoot(folderRoot: string): Promise<string | null> {
  const resolved = folderRoot.trim()
  if (!resolved) return null
  const key = normalizeWorkspaceFolderKey(resolved)
  const workspaces = await listAgentWorkspaces()
  const matched = workspaces.some((item) => normalizeWorkspaceFolderKey(item.folderRoot) === key)
  return matched ? resolved : null
}

export async function listWorkspaceAgentSkills(folderRoot: string): Promise<AgentSkill[]> {
  const resolved = await resolveRegisteredWorkspaceRoot(folderRoot)
  if (!resolved) return []
  return listWorkspaceSkillsFromFolder(resolved)
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
  // 合并结果的 description 可缺省（例如工作区技能没写描述），catalog 对外统一成空串
  return mergeSkillCatalogEntries(software, workspace).map((entry) => ({
    name: entry.name,
    description: entry.description ?? ''
  }))
}
