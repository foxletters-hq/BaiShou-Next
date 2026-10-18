import { describe, expect, it, vi } from 'vitest'
import { SkillReadTool } from '../skill-read.tool'
import type { ToolContext } from '../agent.tool'

describe('SkillReadTool', () => {
  const tool = new SkillReadTool()

  it('should return the skill body when the reader finds the name', async () => {
    const result = await tool.execute({ name: 'daily-brief' }, {
      skillsReader: {
        readSkill: vi.fn().mockResolvedValue({
          name: 'daily-brief',
          description: '写早报',
          content: '读昨天日记。',
          location: '/vault/.agents/skills/daily-brief/SKILL.md'
        })
      }
    } as unknown as ToolContext)

    expect(result).toContain('Skill "daily-brief"')
    expect(result).toContain('写早报')
    expect(result).toContain('读昨天日记。')
  })

  it('should return not found when the reader misses the name', async () => {
    const result = await tool.execute({ name: 'missing' }, {
      skillsReader: { readSkill: vi.fn().mockResolvedValue(null) }
    } as unknown as ToolContext)
    expect(result).toContain('Skill not found: missing')
  })

  it('should return unavailable when the reader is missing', async () => {
    const result = await tool.execute({ name: 'daily-brief' }, {} as ToolContext)
    expect(result).toContain('Skill reader is not available')
  })
})
