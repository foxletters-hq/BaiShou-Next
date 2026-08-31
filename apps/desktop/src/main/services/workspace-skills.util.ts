import * as fs from 'fs/promises'
import * as path from 'path'
import {
  isValidSkillName,
  parseSkillMarkdown,
  type AgentSkill
} from '@baishou/shared'
import { SKILL_FILE_NAME, WORKSPACE_SKILL_RELATIVE_DIRS } from './agent-skills.util'

export function resolveWorkspaceSkillRoots(folderRoot: string): string[] {
  const root = folderRoot.trim()
  if (!root) return []
  return WORKSPACE_SKILL_RELATIVE_DIRS.map((segments) => path.join(root, ...segments))
}

/**
 * 读取工作区根下 skill/、skills/、.agents/skills/ 一层子目录中的 SKILL.md。
 * 同名时后者覆盖前者。
 */
export async function listWorkspaceSkillsFromFolder(folderRoot: string): Promise<AgentSkill[]> {
  const byName = new Map<string, AgentSkill>()
  for (const root of resolveWorkspaceSkillRoots(folderRoot)) {
    let entries: string[] = []
    try {
      entries = await fs.readdir(root)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!isValidSkillName(entry)) continue
      const location = path.join(root, entry, SKILL_FILE_NAME)
      try {
        const markdown = await fs.readFile(location, 'utf-8')
        const parsed = parseSkillMarkdown(markdown, location, { fallbackName: entry })
        if (!parsed) continue
        byName.set(entry, {
          ...parsed,
          name: entry,
          location,
          source: 'workspace'
        })
      } catch {
        // skip unreadable
      }
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}
