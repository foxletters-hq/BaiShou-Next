import { isHiddenBundledSoftwareSkill, type AgentSkill } from '@baishou/shared'
import type { AgentSkillCatalogEntry } from './agent-skills.types'

export function mergeSkillsByName(base: AgentSkill[], overlay: AgentSkill[]): AgentSkill[] {
  const map = new Map<string, AgentSkill>()
  for (const item of base) {
    if (item.name) map.set(item.name, item)
  }
  for (const item of overlay) {
    if (item.name) map.set(item.name, item)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function toCatalogEntries(skills: AgentSkill[]): AgentSkillCatalogEntry[] {
  return skills.map((s) => ({
    name: s.name,
    description: s.description
  }))
}

export function omitBundledTemplateSkills(skills: AgentSkill[]): AgentSkill[] {
  return skills.filter((skill) => !isHiddenBundledSoftwareSkill(skill))
}
