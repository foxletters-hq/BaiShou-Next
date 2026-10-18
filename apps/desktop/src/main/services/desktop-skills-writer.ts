import {
  createAgentSkill,
  createWorkspaceAgentSkill,
  getAgentSkill,
  getWorkspaceAgentSkill,
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
  return {
    async readSkill(name: string) {
      if (folderRoot) {
        const workspace = await getWorkspaceAgentSkill(folderRoot, name)
        if (workspace) {
          return {
            name: workspace.name,
            description: workspace.description,
            content: workspace.content,
            location: workspace.location
          }
        }
      }
      const skill = await getAgentSkill(name)
      if (!skill) return null
      return {
        name: skill.name,
        description: skill.description,
        content: skill.content,
        location: skill.location
      }
    }
  }
}
