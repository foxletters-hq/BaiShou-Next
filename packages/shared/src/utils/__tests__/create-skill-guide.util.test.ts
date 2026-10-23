import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import {
  CREATE_SKILL_GUIDE_PROMPT,
  CREATE_SKILL_GUIDE_PROMPT_WORKSPACE,
  CREATE_SKILL_MANAGER_ID,
  CREATE_SKILL_SLASH_COMMAND,
  getCreateSkillGuidePrompt,
  isProtectedSkill
} from '../create-skill-guide.util'

describe('getCreateSkillGuidePrompt', () => {
  it('directs software-level create-skill to user .agents/skills', () => {
    const prompt = getCreateSkillGuidePrompt()
    expect(prompt).toBe(CREATE_SKILL_GUIDE_PROMPT)
    expect(prompt).toContain('.agents/skills/<name>/SKILL.md')
    expect(prompt).toContain('do not write to AI/skills')
    expect(prompt).toContain('properties')
    expect(prompt).toContain('do not wrap them with ---')
    expect(prompt).not.toContain('frontmatter')
  })

  it('directs workspace create-skill to the project .agents/skills', () => {
    const prompt = getCreateSkillGuidePrompt(undefined, 'workspace')
    expect(prompt).toBe(CREATE_SKILL_GUIDE_PROMPT_WORKSPACE)
    expect(prompt).toContain('.agents/skills/<name>/SKILL.md in the current workspace')
    expect(prompt).toContain('do not write to AI/skills')
    expect(prompt).toContain('properties')
    expect(prompt).toContain('do not wrap them with ---')
    expect(prompt).not.toContain('frontmatter')
  })

  it('should accept TFunction at the type level when building the guide prompt', () => {
    const buildWithTFunction: (t: TFunction) => string = (t) => getCreateSkillGuidePrompt(t)
    expect(typeof buildWithTFunction).toBe('function')
  })
})

describe('isProtectedSkill', () => {
  it('identifies create-skill and built-in skills by id, command, or name', () => {
    expect(isProtectedSkill({ id: CREATE_SKILL_MANAGER_ID })).toBe(true)
    expect(isProtectedSkill({ id: CREATE_SKILL_SLASH_COMMAND })).toBe(true)
    expect(isProtectedSkill({ command: CREATE_SKILL_SLASH_COMMAND })).toBe(true)
    expect(isProtectedSkill({ command: `/${CREATE_SKILL_SLASH_COMMAND}` })).toBe(true)
    expect(isProtectedSkill({ name: CREATE_SKILL_SLASH_COMMAND })).toBe(true)
    expect(isProtectedSkill({ command: 'diary-append' })).toBe(true)
    expect(isProtectedSkill({ command: 'summary-write' })).toBe(true)
    expect(isProtectedSkill({ command: 'summary-repair' })).toBe(true)
    expect(isProtectedSkill({ id: 'custom-1', command: 'code-review' })).toBe(false)
  })
})
