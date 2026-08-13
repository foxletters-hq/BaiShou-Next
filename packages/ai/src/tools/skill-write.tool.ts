import { z } from 'zod'
import { AgentTool, type ToolContext } from './agent.tool'

const skillWriteParams = z.object({
  name: z
    .string()
    .describe('Skill name in kebab-case (lowercase letters, numbers, hyphens). Also used as directory name.'),
  description: z
    .string()
    .describe('Short third-person description of what the skill does and when to use it.'),
  content: z
    .string()
    .describe('Skill body markdown (instructions only; do not include YAML frontmatter).'),
  previous_name: z
    .string()
    .optional()
    .describe('When renaming an existing skill, pass the previous name.')
})

export class SkillWriteTool extends AgentTool<typeof skillWriteParams> {
  readonly name = 'skill_write'

  readonly description =
    'Create or update a software-level Skill as AI/skills/<name>/SKILL.md. ' +
    'Use after gathering name, description, and body with the user. ' +
    'Do not invent a skill without confirmation. Name must be kebab-case.'

  readonly parameters = skillWriteParams

  get category(): string {
    return 'skills'
  }

  get icon(): string {
    return 'sparkles'
  }

  async execute(args: z.infer<typeof skillWriteParams>, context: ToolContext): Promise<string> {
    const writer = context.skillsWriter
    if (!writer?.writeSkill) {
      return 'Error: Skill writer is not available in this environment.'
    }

    try {
      const result = await writer.writeSkill({
        name: args.name,
        description: args.description,
        content: args.content,
        previousName: args.previous_name
      })
      return [
        `Saved skill "${result.name}".`,
        `Location: ${result.location}`,
        result.description ? `Description: ${result.description}` : null
      ]
        .filter(Boolean)
        .join('\n')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Error: Failed to save skill: ${message}`
    }
  }
}
