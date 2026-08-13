import {
  createAgentSkill,
  getAgentSkill,
  updateAgentSkill
} from './agent-skills.service'

/** 注入 ToolContext.skillsWriter：Agent 可经 skill_write 落盘到 AI/skills */
export function createDesktopSkillsWriter() {
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
