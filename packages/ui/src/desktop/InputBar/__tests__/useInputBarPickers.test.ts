import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { CREATE_SKILL_SLASH_COMMAND } from '@baishou/shared'
import { useInputBarPickers } from '../useInputBarPickers'

describe('useInputBarPickers', () => {
  it('should include the create-skill entry when the slash query is empty', () => {
    const { result } = renderHook(() =>
      useInputBarPickers({
        localizedShortcuts: [
          { id: 's1', icon: '', name: '翻译', content: '请翻译', command: 'translate' }
        ],
        slashToken: { query: '', range: document.createRange() },
        mentionToken: null,
        fileMention: undefined,
        insertFileRefChip: () => undefined,
        armCreateSkillChip: () => undefined,
        applyShortcut: () => undefined
      })
    )
    expect(result.current.slashPickerEntries[0]?.kind).toBe('create')
    expect(result.current.slashPickerEntries[0]?.name).toBe(CREATE_SKILL_SLASH_COMMAND)
    expect(result.current.slashPickerEntries.some((entry) => entry.kind === 'skill')).toBe(true)
  })

  it('should hide unmatched skills when the slash query does not match', () => {
    const { result } = renderHook(() =>
      useInputBarPickers({
        localizedShortcuts: [
          { id: 's1', icon: '', name: '翻译', content: '请翻译', command: 'translate' }
        ],
        slashToken: { query: 'zzz', range: document.createRange() },
        mentionToken: null,
        fileMention: undefined,
        insertFileRefChip: () => undefined,
        armCreateSkillChip: () => undefined,
        applyShortcut: () => undefined
      })
    )
    expect(result.current.slashPickerEntries.every((entry) => entry.kind !== 'skill')).toBe(true)
  })
})
