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
    .describe(
      'Skill body markdown only. Do not include the properties header (name/description) or --- fences; pass those as name and description arguments.'
    ),
  previous_name: z
    .string()
    .optional()
    .describe('When renaming an existing skill, pass the previous name.')
})

export class SkillWriteTool extends AgentTool<typeof skillWriteParams> {
  readonly name = 'skill_write'

  readonly description =
    'Create or update a Skill as .agents/skills/<name>/SKILL.md in the current scope ' +
    '(user home for companion chat, workspace root for a project session). ' +
    'Use after gathering name, description, and body with the user. ' +
    'Do not invent a skill without confirmation. Name must be kebab-case. ' +
    'Do not write SKILL.md with workspace file tools.'

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
