import { describe, expect, it } from 'vitest'
import {
  DIARY_APPEND_SKILL_CONTENT,
  DIARY_APPEND_SKILL_DESCRIPTION,
  DIARY_APPEND_SKILL_NAME,
  SUMMARY_WRITE_SKILL_CONTENT,
  SUMMARY_WRITE_SKILL_DESCRIPTION,
  SUMMARY_WRITE_SKILL_NAME
} from '../../constants/builtin-skills'
import {
  appendShortcutInsertText,
  dedupePromptShortcuts,
  filterShortcutsByQuery,
  formatShortcutInsertText,
  findShortcutCommandConflict,
  getShortcutCommand,
  localizeAgentSkill,
  localizePromptShortcut,
  shouldStartShortcutSession
} from '../prompt-shortcut.util'

describe('prompt-shortcut.util', () => {
  const shortcuts = [
    { id: 'default-translate', icon: '🌐', name: '翻译助手', content: 'translate prompt' },
    { id: 'custom-1', icon: '⚡', name: '周报', content: 'weekly', command: 'weekly' }
  ]

  it('derives default shortcut command from id slug', () => {
    expect(getShortcutCommand(shortcuts[0]!)).toBe('translate')
  })

  it('uses explicit command when present', () => {
    expect(getShortcutCommand(shortcuts[1]!)).toBe('weekly')
  })

  it('only starts shortcut session from empty input', () => {
    expect(shouldStartShortcutSession('', '/')).toBe(true)
    expect(shouldStartShortcutSession('', '/we')).toBe(true)
    expect(shouldStartShortcutSession('hello', 'hello/')).toBe(false)
  })

  it('filters shortcuts by command or name', () => {
    expect(filterShortcutsByQuery(shortcuts, 'tran').map((s) => s.id)).toEqual([
      'default-translate'
    ])
    expect(filterShortcutsByQuery(shortcuts, '周').map((s) => s.id)).toEqual(['custom-1'])
    expect(filterShortcutsByQuery(shortcuts, '')).toHaveLength(2)
  })

  it('filters shortcuts by description when present', () => {
    const withDesc = [
      ...shortcuts,
      {
        id: 'daily-brief',
        name: 'daily-brief',
        command: 'daily-brief',
        description: '根据昨天日记写早报',
        content: 'body'
      }
    ]
    expect(filterShortcutsByQuery(withDesc, '早报').map((s) => s.id)).toEqual(['daily-brief'])
  })

  it('appends trailing newline when inserting shortcut content', () => {
    expect(formatShortcutInsertText('hello')).toBe('hello\n')
    expect(formatShortcutInsertText('hello\n')).toBe('hello\n')
  })

  it('appends shortcut content to existing input instead of replacing', () => {
    expect(appendShortcutInsertText('', 'translate prompt')).toBe('translate prompt\n')
    expect(appendShortcutInsertText('existing text', 'translate prompt')).toBe(
      'existing text\ntranslate prompt\n'
    )
  })

  it('dedupes by id and command', () => {
    const merged = dedupePromptShortcuts([
      ...shortcuts,
      { id: 'dup-id', icon: '', name: '重复', content: 'a', command: 'weekly' },
      { id: 'custom-1', icon: '', name: '重复 id', content: 'b', command: 'other' }
    ])
    expect(merged).toHaveLength(2)
    expect(merged.map((s) => s.id)).toEqual(['default-translate', 'custom-1'])
  })

  it('detects command conflicts', () => {
    expect(
      findShortcutCommandConflict(shortcuts, {
        id: 'new',
        icon: '',
        name: 'x',
        content: 'x',
        command: 'weekly'
      })
    ).toMatchObject({ id: 'custom-1' })
    expect(findShortcutCommandConflict(shortcuts, shortcuts[1]!, 'custom-1')).toBeUndefined()
  })

  it('localizes built-in default shortcuts', () => {
    const labels = {
      translateName: 'Translate',
      translateContent: 'Translate this:\n\n',
      summarizeName: 'Summarize',
      summarizeContent: 'Summarize this:\n\n'
    }
    const localized = localizePromptShortcut(
      { id: 'default-translate', icon: '🌐', name: '翻译', content: 'old' },
      labels
    )
    expect(localized.name).toBe('Translate')
    expect(localized.content).toBe('Translate this:\n\n')
    expect(getShortcutCommand(localized)).toBe('translate')
  })

  it('localizes display name and description of built-in skills while keeping English skill content', () => {
    const labels = {
      translateName: 'Translate',
      translateContent: 'Translate this:\n\n',
      summarizeName: 'Summarize',
      summarizeContent: 'Summarize this:\n\n',
      diaryAppendName: '补充日记',
      diaryAppendDescription: '将近期对话补充进个人日记。',
      summaryWriteName: '生成周期总结',
      summaryWriteDescription: '检测缺失总结并撰写落盘。'
    }
    const diaryShortcut = localizePromptShortcut(
      {
        id: DIARY_APPEND_SKILL_NAME,
        command: DIARY_APPEND_SKILL_NAME,
        name: DIARY_APPEND_SKILL_DESCRIPTION,
        description: DIARY_APPEND_SKILL_DESCRIPTION,
        content: DIARY_APPEND_SKILL_CONTENT,
        source: 'software' as const
      },
      labels
    )
    expect(diaryShortcut.name).toBe('补充日记')
    expect(diaryShortcut.description).toBe('将近期对话补充进个人日记。')
    expect(diaryShortcut.content).toBe(DIARY_APPEND_SKILL_CONTENT)

    const summarySkill = localizeAgentSkill(
      {
        name: SUMMARY_WRITE_SKILL_NAME,
        description: SUMMARY_WRITE_SKILL_DESCRIPTION,
        content: SUMMARY_WRITE_SKILL_CONTENT,
        location: '/vault/AI/skills/summary-write/SKILL.md',
        source: 'software' as const
      },
      labels
    )
    expect(summarySkill.description).toBe('检测缺失总结并撰写落盘。')
    expect(summarySkill.content).toBe(SUMMARY_WRITE_SKILL_CONTENT)
  })

  it('places built-in protected skills ahead of custom skills in canonical order', () => {
    const merged = dedupePromptShortcuts([
      { id: '123', command: '123', name: '123', content: '123' },
      { id: 'asd', command: 'asd', name: 'asd', content: 'asd' },
      {
        id: SUMMARY_WRITE_SKILL_NAME,
        command: SUMMARY_WRITE_SKILL_NAME,
        name: SUMMARY_WRITE_SKILL_DESCRIPTION,
        content: SUMMARY_WRITE_SKILL_CONTENT
      },
      {
        id: DIARY_APPEND_SKILL_NAME,
        command: DIARY_APPEND_SKILL_NAME,
        name: DIARY_APPEND_SKILL_DESCRIPTION,
        content: DIARY_APPEND_SKILL_CONTENT
      },
      {
        id: 'create-skill',
        command: 'create-skill',
        name: 'create-skill',
        content: 'guide'
      }
    ])
    expect(merged.map((s) => s.command)).toEqual([
      'create-skill',
      DIARY_APPEND_SKILL_NAME,
      SUMMARY_WRITE_SKILL_NAME,
      '123',
      'asd'
    ])
  })
})
