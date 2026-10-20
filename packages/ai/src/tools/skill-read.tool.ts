import { DEFAULT_AGENT_SKILLS, mergeSkillCatalogEntries } from '@baishou/shared'
import { z } from 'zod'
import { AgentTool, type ToolContext } from './agent.tool'

const skillReadParams = z.object({
  name: z
    .string()
    .optional()
    .describe(
      'Optional skill name in kebab-case (e.g. "summary-write", "diary-append"). ' +
        'Omit or leave empty to list all available skills and their descriptions; ' +
        'pass a specific skill name to read its full SKILL.md workflow instructions.'
    )
})

async function listAvailableSkillEntries(
  context: ToolContext
): Promise<Array<{ name: string; description?: string }>> {
  const defaults = DEFAULT_AGENT_SKILLS.map((item) => ({
    name: item.name,
    description: item.description
  }))
  const fromReader = (await context.skillsReader?.listSkills?.()) ?? []
  return mergeSkillCatalogEntries(defaults, fromReader)
}

export class SkillReadTool extends AgentTool<typeof skillReadParams> {
  readonly name = 'skill_read'

  readonly description =
    'List available skills or read the full SKILL.md workflow body for a specific skill. ' +
    'Omit `name` (or pass empty string) to list all available skills and their descriptions ' +
    '(including built-in skills like "diary-append" for appending conversation events to the diary and ' +
    '"summary-write" for bitmap-detecting and writing weekly/monthly/quarterly/yearly summaries, plus user custom skills). ' +
    'Pass `name` to read the full SKILL.md instructions before executing that workflow.'

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
    const name = (args.name ?? '').trim()

    if (!name || name === 'list') {
      try {
        const entries = await listAvailableSkillEntries(context)
        if (entries.length === 0) {
          return 'No skills available.'
        }
        const lines = [
          `Available skills (${entries.length}):`,
          '',
          ...entries.map((item) =>
            item.description ? `- **${item.name}**: ${item.description}` : `- **${item.name}**`
          ),
          '',
          'Call `skill_read` with `name: "<skill_name>"` to read the full SKILL.md instructions for a specific skill.'
        ]
        return lines.join('\n')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return `Error: Failed to list skills: ${message}`
      }
    }

    if (!reader?.readSkill) {
      return 'Error: Skill reader is not available in this environment.'
    }

    try {
      let skill = await reader.readSkill(name)
      if (!skill) {
        const builtin = DEFAULT_AGENT_SKILLS.find((item) => item.name === name)
        if (builtin) {
          skill = {
            name: builtin.name,
            description: builtin.description,
            content: builtin.content,
            location: `AI/skills/${builtin.name}/SKILL.md`
          }
        }
      }
      if (!skill) {
        return `Error: Skill not found: ${name}`
      }
      const baseDirectory = skill.location ? skill.location.replace(/[\\/][^\\/]+$/, '') : ''
      let resources: string[] = []
      if (reader.listResources) {
        try {
          resources = await reader.listResources(name)
        } catch {
          resources = []
        }
      }
      return [
        `Skill "${skill.name}"`,
        skill.description ? `Description: ${skill.description}` : null,
        skill.location ? `Location: ${skill.location}` : null,
        baseDirectory ? `Base directory: ${baseDirectory}` : null,
        '',
        skill.content,
        ...(baseDirectory
          ? [
              '',
              `Relative paths in this skill (e.g. scripts/, reference/) are relative to: ${baseDirectory}`
            ]
          : []),
        ...(resources.length > 0
          ? [
              '',
              '<skill_files>',
              ...resources.map((file) => `<file>${file}</file>`),
              '</skill_files>'
            ]
          : [])
      ]
        .filter((line) => line !== null)
        .join('\n')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `Error: Failed to read skill: ${message}`
    }
  }
}
