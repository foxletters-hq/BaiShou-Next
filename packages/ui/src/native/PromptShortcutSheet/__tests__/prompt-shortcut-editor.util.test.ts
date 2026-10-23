import { describe, expect, it } from 'vitest'
import {
  buildShortcutEditorPayload,
  resolveShortcutEditorDraft
} from '../prompt-shortcut-editor.util'

describe('resolveShortcutEditorDraft', () => {
  it('should put skill command in the name field and description in the description field', () => {
    const draft = resolveShortcutEditorDraft({
      id: 'daily-writer',
      command: 'daily-writer',
      name: '日常写作助理',
      description: '日常写作助理',
      content: '根据输入撰写今日短篇日记。'
    })

    expect(draft.command).toBe('daily-writer')
    expect(draft.description).toBe('日常写作助理')
    expect(draft.content).toBe('根据输入撰写今日短篇日记。')
  })

  it('should keep a legacy custom shortcut name as the slash command when command is missing', () => {
    const draft = resolveShortcutEditorDraft({
      id: 'custom-1',
      name: '翻译',
      content: '请翻译下面的文本。'
    })

    expect(draft.command).toBe('翻译')
    expect(draft.description).toBe('')
    expect(draft.content).toBe('请翻译下面的文本。')
  })
})

describe('buildShortcutEditorPayload', () => {
  it('should write description separately instead of stuffing it into the display name', () => {
    const payload = buildShortcutEditorPayload(
      { id: 'custom-1', name: '旧名', content: '旧正文' },
      { command: 'daily-writer', description: '日常写作助理', content: '根据输入撰写。' },
      'Skill'
    )

    expect(payload.command).toBe('daily-writer')
    expect(payload.description).toBe('日常写作助理')
    expect(payload.name).toBe('日常写作助理')
    expect(payload.content).toBe('根据输入撰写。')
  })
})
