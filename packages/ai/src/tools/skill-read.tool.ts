import { z } from 'zod'
import { AgentTool, type ToolContext } from './agent.tool'

const skillReadParams = z.object({
  name: z.string().describe('Skill name in kebab-case, matching an entry in the skills catalog.')
})

export class SkillReadTool extends AgentTool<typeof skillReadParams> {
  readonly name = 'skill_read'

  readonly description =
    'Read the full SKILL.md body for one skill listed in the skills catalog. ' +
    'Use after you decide that skill applies. Do not load unused skill bodies. ' +
    'The user may also attach a skill with /name; then you already have the body.'

  readonly parameters = skillReadParams

  get category(): string {
    return 'skills'
  }

  get icon(): string {
    return 'book-open'
  }

  get canBeDisabled(): boolean {
    return false
  }

  async execute(args: z.infer<typeof skillReadParams>, context: ToolContext): Promise<string> {
    const reader = context.skillsReader
    if (!reader?.readSkill) {
      return 'Error: Skill reader is not available in this environment.'
    }

    const name = args.name.trim()
    try {
      const skill = await reader.readSkill(name)
      if (!skill) return `Error: Skill not found: ${name}`
      return [
        `Skill "${skill.name}"`,
        skill.description ? `Description: ${skill.description}` : null,
        skill.location ? `Location: ${skill.location}` : null,
        '',
        skill.content
      ]
        .filter((line) => line !== null)
        .join('\n')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Error: Failed to read skill: ${message}`
    }
  }
}
