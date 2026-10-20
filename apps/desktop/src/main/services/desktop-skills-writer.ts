import * as fs from 'fs/promises'
import * as path from 'path'
import {
  createAgentSkill,
  createWorkspaceAgentSkill,
  getAgentSkill,
  getWorkspaceAgentSkill,
  listAgentSkills,
  listAgentSkillsCatalog,
  listAgentSkillsCatalogForWorkspace,
  updateAgentSkill,
  updateWorkspaceAgentSkill
} from './agent-skills.service'

/** 注入 ToolContext.skillsWriter：Agent 经 skill_write 写入 `.agents/skills` */
export function createDesktopSkillsWriter(options?: { folderRoot?: string }) {
  const folderRoot = options?.folderRoot?.trim()
  if (folderRoot) {
    return {
      async writeSkill(input: {
        name: string
        description: string
        content: string
        previousName?: string
      }) {
        const previousName = input.previousName?.trim()
        if (previousName) {
          const updated = await updateWorkspaceAgentSkill(folderRoot, {
            previousName,
            name: input.name,
            description: input.description,
            content: input.content
          })
          return {
            name: updated.name,
            description: updated.description,
            location: updated.location
          }
        }

        const existing = await getWorkspaceAgentSkill(folderRoot, input.name)
        if (existing) {
          const updated = await updateWorkspaceAgentSkill(folderRoot, {
            previousName: input.name,
            name: input.name,
            description: input.description,
            content: input.content
          })
          return {
            name: updated.name,
            description: updated.description,
            location: updated.location
          }
        }

        const created = await createWorkspaceAgentSkill(folderRoot, {
          name: input.name,
          description: input.description,
          content: input.content
        })
        return {
          name: created.name,
          description: created.description,
          location: created.location
        }
      }
    }
  }

  return {
    async writeSkill(input: {
      name: string
      description: string
      content: string
      previousName?: string
    }) {
      const previousName = input.previousName?.trim()
      if (previousName) {
        const updated = await updateAgentSkill({
          previousName,
          name: input.name,
          description: input.description,
          content: input.content
        })
        return {
          name: updated.name,
          description: updated.description,
          location: updated.location
        }
      }

      const existing = await getAgentSkill(input.name)
      if (existing) {
        const updated = await updateAgentSkill({
          previousName: input.name,
          name: input.name,
          description: input.description,
          content: input.content
        })
        return {
          name: updated.name,
          description: updated.description,
          location: updated.location
        }
      }

      const created = await createAgentSkill({
        name: input.name,
        description: input.description,
        content: input.content
      })
      return {
        name: created.name,
        description: created.description,
        location: created.location
      }
    }
  }
}

/** 注入 ToolContext.skillsReader：按名读取当前范围的 SKILL.md */
export function createDesktopSkillsReader(options?: { folderRoot?: string }) {
  const folderRoot = options?.folderRoot?.trim()

  const resolveSkill = async (name: string) => {
    if (folderRoot) {
      const workspace = await getWorkspaceAgentSkill(folderRoot, name)
      if (workspace) return workspace
    }
    return getAgentSkill(name)
  }

  return {
    async readSkill(name: string) {
      const skill = await resolveSkill(name)
      if (!skill) return null
      return {
        name: skill.name,
        description: skill.description,
        content: skill.content,
        location: skill.location
      }
    },
    async listSkills() {
      if (folderRoot) {
        return listAgentSkillsCatalogForWorkspace(folderRoot)
      }
      return listAgentSkillsCatalog()
    },
    async listAllSkills() {
      return (await listAgentSkills()).map((skill) => ({
        name: skill.name,
        description: skill.description
      }))
    },
    async listResources(name: string) {
      const skill = await resolveSkill(name)
      if (!skill?.location) return []
      return listSkillResourceFiles(skill.location)
    }
  }
}

const MAX_SKILL_RESOURCE_FILES = 10
const MAX_SKILL_RESOURCE_DEPTH = 2

/** 列出技能目录下的资源文件（相对路径，最多 10 个；跳过 SKILL.md 与隐藏项） */
export async function listSkillResourceFiles(skillFilePath: string): Promise<string[]> {
  const root = path.dirname(skillFilePath)
  const out: string[] = []

  const walk = async (current: string, depth: number): Promise<void> => {
    if (out.length >= MAX_SKILL_RESOURCE_FILES || depth > MAX_SKILL_RESOURCE_DEPTH) return
    let entries: Array<{ name: string; isDirectory(): boolean }> = []
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
      if (out.length >= MAX_SKILL_RESOURCE_FILES) return
      if (entry.name.startsWith('.')) continue
      const abs = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(abs, depth + 1)
        continue
      }
      if (abs === skillFilePath) continue
      out.push(path.relative(root, abs).replace(/\\/g, '/'))
    }
  }

  await walk(root, 0)
  return out
}
