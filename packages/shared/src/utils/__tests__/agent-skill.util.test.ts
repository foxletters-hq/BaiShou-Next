import {
  isValidSkillName,
  parseSkillMarkdown,
  promptShortcutToSkillInput,
  serializeSkillMarkdown,
  skillToPromptShortcut,
  slugifySkillName
} from '../agent-skill.util'

describe('agent-skill.util', () => {
  it('validates kebab-case skill names', () => {
    expect(isValidSkillName('translate')).toBe(true)
    expect(isValidSkillName('git-release')).toBe(true)
    expect(isValidSkillName('Translate')).toBe(false)
    expect(isValidSkillName('-bad')).toBe(false)
  })

  it('slugifies display names', () => {
    expect(slugifySkillName('Code Review')).toBe('code-review')
    expect(slugifySkillName('翻译')).toMatch(/^skill-/)
  })

  it('round-trips skill markdown', () => {
    const markdown = serializeSkillMarkdown({
      name: 'translate',
      description: '翻译',
      content: '请翻译：\n\n'
    })
    const parsed = parseSkillMarkdown(markdown, '/tmp/translate/SKILL.md')
    expect(parsed).toEqual({
      name: 'translate',
      description: '翻译',
      content: '请翻译：',
      location: '/tmp/translate/SKILL.md'
    })
  })

  it('maps skill <-> prompt shortcut', () => {
    const shortcut = skillToPromptShortcut({
      name: 'summarize',
      description: '总结',
      content: '请总结',
      location: '/x/SKILL.md'
    })
    expect(shortcut).toMatchObject({
      id: 'summarize',
      command: 'summarize',
      name: '总结',
      content: '请总结'
    })
    expect(promptShortcutToSkillInput(shortcut)).toEqual({
      name: 'summarize',
      description: '总结',
      content: '请总结'
    })
  })
})
