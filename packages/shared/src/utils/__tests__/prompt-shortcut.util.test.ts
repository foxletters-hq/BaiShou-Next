import { describe, expect, it } from 'vitest'
import {
  appendShortcutInsertText,
  dedupePromptShortcuts,
  filterShortcutsByQuery,
  formatShortcutInsertText,
  findShortcutCommandConflict,
  getShortcutCommand,
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
})
