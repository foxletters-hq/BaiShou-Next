import {
  getSkillsRootMtimeMs,
  resolveBundledSkillsRoot,
  resolveUserAgentsSkillsRoot
} from './agent-skills-fs'
import { omitBundledTemplateSkills, toCatalogEntries } from './agent-skills-merge.util'
import { ensureSkillsReady } from './agent-skills-migrate'
import {
  catalogCache,
  defaultsEnsuredInProcess,
  migrateDoneInProcess,
  relocateDoneInProcess,
  removeRetiredOfficialDoneInProcess,
  removeWriterDoneInProcess,
  setCatalogCache
} from './agent-skills-state'
import type { AgentSkillCatalogEntry } from './agent-skills.types'
import type { AgentSkill } from '@baishou/shared'

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
  setCatalogCache({
    bundledRoot,
    userRoot,
    bundledMtimeMs: await getSkillsRootMtimeMs(bundledRoot),
    userMtimeMs: await getSkillsRootMtimeMs(userRoot),
    entries
  })
  return entries
}

export async function getAiSkillsRoot(): Promise<string> {
  return resolveBundledSkillsRoot()
}

export async function getWritableUserSkillsRoot(): Promise<string> {
  return resolveUserAgentsSkillsRoot()
}
