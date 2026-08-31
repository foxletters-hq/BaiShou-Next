import { describe, expect, it } from 'vitest'
import { CREATE_SKILL_GUIDE_PROMPT, CREATE_SKILL_SLASH_COMMAND } from '../create-skill-guide.util'
import {
  DEFAULT_AGENT_SKILLS,
  isBundledReservedSkillName,
  isHiddenBundledSoftwareSkill,
  isOfficialAgentSkillName,
  isRetiredOfficialSkillName,
  isSkillMarkdownPath,
  isValidSkillName,
  listSkillNamesToRelocateFromOfficial,
  mergeSkillCatalogEntries,
  parseSkillMarkdown,
  planOfficialSkillRelocations,
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

  it('round-trips skill markdown as properties without yaml fences', () => {
    const markdown = serializeSkillMarkdown({
      name: 'translate',
      description: '翻译',
      content: '请翻译：\n\n'
    })
    expect(markdown.startsWith('name: translate\n')).toBe(true)
    expect(markdown).not.toMatch(/^---/m)
    const parsed = parseSkillMarkdown(markdown, '/tmp/translate/SKILL.md')
    expect(parsed).toEqual({
      name: 'translate',
      description: '翻译',
      content: '请翻译：',
      location: '/tmp/translate/SKILL.md'
    })
  })

  it('reads properties header that is immediately followed by a heading', () => {
    const parsed = parseSkillMarkdown(
      'name: daily-news-digest\ndescription: 整理当天新闻\n# Daily News Digest\n',
      '/tmp/daily-news-digest/SKILL.md'
    )
    expect(parsed).toMatchObject({
      name: 'daily-news-digest',
      description: '整理当天新闻',
      content: '# Daily News Digest'
    })
  })

  it('reads properties header without yaml fences', () => {
    const parsed = parseSkillMarkdown(
      'name: daily-news-digest\ndescription: 整理当天新闻\n\n# 简报\n',
      '/tmp/daily-news-digest/SKILL.md'
    )
    expect(parsed).toEqual({
      name: 'daily-news-digest',
      description: '整理当天新闻',
      content: '# 简报',
      location: '/tmp/daily-news-digest/SKILL.md'
    })
  })

  it('reads legacy yaml frontmatter', () => {
    const parsed = parseSkillMarkdown(
      '---\nname: translate\ndescription: 翻译\n---\n\n请翻译：\n',
      '/tmp/translate/SKILL.md'
    )
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
      content: '请总结',
      source: 'software'
    })
    expect(promptShortcutToSkillInput(shortcut)).toEqual({
      name: 'summarize',
      description: '总结',
      content: '请总结'
    })
  })

  it('uses directory fallback when properties header is missing', () => {
    const parsed = parseSkillMarkdown('请先检查目录。', '/tmp/writer/SKILL.md', {
      fallbackName: 'writer'
    })
    expect(parsed).toEqual({
      name: 'writer',
      description: 'writer',
      content: '请先检查目录。',
      location: '/tmp/writer/SKILL.md'
    })
  })

  it('prefers directory fallback over properties name', () => {
    const markdown = serializeSkillMarkdown({
      name: 'other-name',
      description: '说明',
      content: '正文'
    })
    const parsed = parseSkillMarkdown(markdown, '/tmp/writer/SKILL.md', {
      fallbackName: 'writer'
    })
    expect(parsed?.name).toBe('writer')
    expect(parsed?.description).toBe('说明')
  })

  it('maps user skills to the software shortcut id', () => {
    const shortcut = skillToPromptShortcut({
      name: 'summarize',
      description: '我的总结',
      content: '请总结',
      location: '/home/.agents/skills/summarize/SKILL.md',
      source: 'user'
    })
    expect(shortcut).toMatchObject({
      id: 'summarize',
      command: 'summarize',
      source: 'software'
    })
  })

  it('maps workspace skills to a distinct shortcut id', () => {
    const shortcut = skillToPromptShortcut({
      name: 'writer',
      description: '项目作家',
      content: '项目正文',
      location: '/proj/skills/writer/SKILL.md',
      source: 'workspace'
    })
    expect(shortcut).toMatchObject({
      id: 'workspace:writer',
      command: 'writer',
      source: 'workspace'
    })
  })

  it('detects SKILL.md paths', () => {
    expect(isSkillMarkdownPath('.agents/skills/daily-news-digest/SKILL.md')).toBe(true)
    expect(isSkillMarkdownPath('SKILL.md')).toBe(true)
    expect(isSkillMarkdownPath('notes.md')).toBe(false)
  })

  it('treats only bundled defaults as official skill names', () => {
    expect(isOfficialAgentSkillName(CREATE_SKILL_SLASH_COMMAND)).toBe(true)
    expect(isOfficialAgentSkillName('translate')).toBe(false)
    expect(isOfficialAgentSkillName('summarize')).toBe(false)
    expect(isRetiredOfficialSkillName('translate')).toBe(true)
    expect(isRetiredOfficialSkillName('summarize')).toBe(true)
    expect(isHiddenBundledSoftwareSkill({ name: 'translate', source: 'software' })).toBe(true)
    expect(isHiddenBundledSoftwareSkill({ name: 'summarize' })).toBe(true)
    expect(isHiddenBundledSoftwareSkill({ name: 'translate', source: 'user' })).toBe(false)
    expect(isOfficialAgentSkillName('skill-create')).toBe(false)
    expect(isOfficialAgentSkillName('writer')).toBe(false)
    expect(isOfficialAgentSkillName('story-init')).toBe(false)
    expect(isBundledReservedSkillName('writer')).toBe(false)
    expect(isBundledReservedSkillName('story-init')).toBe(true)
    expect(isOfficialAgentSkillName('idea-research')).toBe(false)
    expect(isOfficialAgentSkillName('daily-digest')).toBe(false)
    const createSkill = DEFAULT_AGENT_SKILLS.find((skill) => skill.name === CREATE_SKILL_SLASH_COMMAND)
    expect(createSkill?.description).toBe(CREATE_SKILL_SLASH_COMMAND)
    expect(createSkill?.content).toBe(CREATE_SKILL_GUIDE_PROMPT)
  })

  it('relocates non-official names out of the official skill root', () => {
    expect(
      listSkillNamesToRelocateFromOfficial([
        'translate',
        'writer',
        'story-init',
        'idea-research',
        '123',
        'Not Valid',
        ''
      ])
    ).toEqual(['translate', 'writer', 'idea-research', '123'])
    expect(
      planOfficialSkillRelocations(
        ['translate', 'idea-research', 'daily-digest', 'summarize'],
        new Set(['daily-digest'])
      )
    ).toEqual([
      { name: 'translate', action: 'move' },
      { name: 'idea-research', action: 'move' },
      { name: 'daily-digest', action: 'remove-official' },
      { name: 'summarize', action: 'move' }
    ])
  })

  it('lets workspace catalog entries replace software entries with the same name', () => {
    expect(
      mergeSkillCatalogEntries(
        [{ name: 'writer', description: '软件作家' }, { name: 'translate' }],
        [{ name: 'writer', description: '项目作家' }]
      )
    ).toEqual([
      { name: 'writer', description: '项目作家' },
      { name: 'translate' }
    ])
  })
})
