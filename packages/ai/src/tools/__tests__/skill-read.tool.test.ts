import { describe, expect, it, vi } from 'vitest'
import { SkillReadTool } from '../skill-read.tool'
import type { ToolContext } from '../agent.tool'

describe('SkillReadTool', () => {
  const tool = new SkillReadTool()

  it('should list available built-in and custom skills when name is omitted', async () => {
    const result = await tool.execute({}, {
      skillsReader: {
        readSkill: vi.fn(),
        listSkills: vi.fn().mockResolvedValue([{ name: 'daily-brief', description: '写每日简报' }])
      }
    } as unknown as ToolContext)

    expect(result).toContain('Available skills')
    expect(result).toContain('diary-append')
    expect(result).toContain('summary-write')
    expect(result).toContain('summary-repair')
    expect(result).toContain('daily-brief')
    expect(result).toContain('写每日简报')
  })

  it('should return the skill body when the reader finds the name', async () => {
    const result = await tool.execute({ name: 'daily-brief' }, {
      skillsReader: {
        readSkill: vi.fn().mockResolvedValue({
          name: 'daily-brief',
          description: '写早报',
          content: '读昨天日记。',
          location: '/vault/.agents/skills/daily-brief/SKILL.md'
        }),
        listResources: vi.fn().mockResolvedValue(['scripts/build.sh', 'reference/notes.md'])
      }
    } as unknown as ToolContext)

    expect(result).toContain('Skill "daily-brief"')
    expect(result).toContain('写早报')
    expect(result).toContain('读昨天日记。')
    expect(result).toContain('Base directory: /vault/.agents/skills/daily-brief')
    expect(result).toContain('<skill_files>')
    expect(result).toContain('<file>scripts/build.sh</file>')
  })

  it('should fall back to built-in skill definition when disk reader returns null', async () => {
    const result = await tool.execute({ name: 'summary-write' }, {
      skillsReader: {
        readSkill: vi.fn().mockResolvedValue(null)
      }
    } as unknown as ToolContext)

    expect(result).toContain('Skill "summary-write"')
    expect(result).toContain('Period Summary Detection & Generation')
  })

  it('should return not found when the reader misses an unknown name', async () => {
    const result = await tool.execute({ name: 'missing' }, {
      skillsReader: { readSkill: vi.fn().mockResolvedValue(null) }
    } as unknown as ToolContext)
    expect(result).toContain('Skill not found: missing')
  })

  it('should return unavailable when the reader is missing for a specific skill read', async () => {
    const result = await tool.execute({ name: 'daily-brief' }, {} as ToolContext)
    expect(result).toContain('Skill reader is not available')
  })
})
