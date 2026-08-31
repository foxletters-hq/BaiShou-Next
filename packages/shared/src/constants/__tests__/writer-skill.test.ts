import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AGENT_SKILLS,
  isBundledReservedSkillName,
  isValidSkillName
} from '../../utils/agent-skill.util'
import {
  LEGACY_WRITER_SKILL_NAME,
  STORY_INIT_SKILL_NAME,
  WRITER_SKILL,
  WRITER_SKILL_CONTENT,
  WRITER_SKILL_NAME,
  isWorkbenchTemplateSkillName
} from '../writer-skill'

describe('writer-skill', () => {
  it('keeps story-init as a reserved template, not a default official skill', () => {
    expect(WRITER_SKILL_NAME).toBe('story-init')
    expect(STORY_INIT_SKILL_NAME).toBe('story-init')
    expect(isValidSkillName(WRITER_SKILL_NAME)).toBe(true)
    expect(isWorkbenchTemplateSkillName(WRITER_SKILL_NAME)).toBe(true)
    expect(isWorkbenchTemplateSkillName(LEGACY_WRITER_SKILL_NAME)).toBe(false)
    expect(isBundledReservedSkillName(WRITER_SKILL_NAME)).toBe(true)
    expect(isBundledReservedSkillName(LEGACY_WRITER_SKILL_NAME)).toBe(false)
    expect(DEFAULT_AGENT_SKILLS.some((skill) => skill.name === WRITER_SKILL_NAME)).toBe(false)
  })

  it('asks before creating and writes per-folder writing specs', () => {
    expect(WRITER_SKILL.content).toBe(WRITER_SKILL_CONTENT)
    expect(WRITER_SKILL_CONTENT).toContain('空目录')
    expect(WRITER_SKILL_CONTENT).toContain('非空目录')
    expect(WRITER_SKILL_CONTENT).toContain('新建一个文件夹来存放整套小说架构')
    expect(WRITER_SKILL_CONTENT).toContain('companion_ask')
    expect(WRITER_SKILL_CONTENT).toContain('不要把问题写在普通回复里')
    expect(WRITER_SKILL_CONTENT).toContain('写作根目录')
    expect(WRITER_SKILL_CONTENT).toContain('不要把模板文件铺进当前根目录')
    expect(WRITER_SKILL_CONTENT).toContain('目录结构.md')
    expect(WRITER_SKILL_CONTENT).toContain('规范.md')
    expect(WRITER_SKILL_CONTENT).toContain('001-030')
    expect(WRITER_SKILL_CONTENT).toContain('031-060')
    expect(WRITER_SKILL_CONTENT).toContain('每 30 章')
    expect(WRITER_SKILL_CONTENT).toContain('设定/')
    expect(WRITER_SKILL_CONTENT).toContain('素材/')
    expect(WRITER_SKILL_CONTENT).toContain('小说/')
    expect(WRITER_SKILL_CONTENT).toContain('禁止覆盖')
    expect(WRITER_SKILL_CONTENT).toContain('必须同时改')
  })
})
