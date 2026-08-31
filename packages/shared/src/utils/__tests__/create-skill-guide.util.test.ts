import { describe, expect, it } from 'vitest'
import {
  CREATE_SKILL_GUIDE_PROMPT,
  CREATE_SKILL_GUIDE_PROMPT_WORKSPACE,
  getCreateSkillGuidePrompt
} from '../create-skill-guide.util'

describe('getCreateSkillGuidePrompt', () => {
  it('directs software-level create-skill to user .agents/skills', () => {
    const prompt = getCreateSkillGuidePrompt()
    expect(prompt).toBe(CREATE_SKILL_GUIDE_PROMPT)
    expect(prompt).toContain('.agents/skills/<name>/SKILL.md')
    expect(prompt).toContain('不要写入 AI/skills')
    expect(prompt).toContain('properties')
    expect(prompt).toContain('不要用 --- 包裹')
    expect(prompt).not.toContain('frontmatter')
  })

  it('directs workspace create-skill to the project .agents/skills', () => {
    const prompt = getCreateSkillGuidePrompt(undefined, 'workspace')
    expect(prompt).toBe(CREATE_SKILL_GUIDE_PROMPT_WORKSPACE)
    expect(prompt).toContain('当前工作区 .agents/skills/<name>/SKILL.md')
    expect(prompt).toContain('不要写入 AI/skills')
    expect(prompt).toContain('properties')
    expect(prompt).toContain('不要用 --- 包裹')
    expect(prompt).not.toContain('frontmatter')
  })
})
