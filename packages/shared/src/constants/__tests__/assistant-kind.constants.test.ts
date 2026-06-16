import { describe, it, expect } from 'vitest'
import {
  getAssistantDisabledToolIds,
  mergeDisabledToolIds,
  normalizeAssistantKind
} from '../assistant-kind.constants'

describe('assistant-kind.constants', () => {
  it('should disable diary and memory tools for work assistants', () => {
    const ids = getAssistantDisabledToolIds('work')
    expect(ids).toContain('diary_edit')
    expect(ids).toContain('summary_read')
    expect(ids).toContain('vector_search')
    expect(ids).not.toContain('web_search')
  })

  it('should not add extra disabled tools for companion assistants', () => {
    expect(getAssistantDisabledToolIds('companion')).toEqual([])
  })

  it('should merge global and assistant disabled tool ids', () => {
    const merged = mergeDisabledToolIds(['web_search'], 'work')
    expect(merged).toContain('web_search')
    expect(merged).toContain('diary_write')
  })

  it('should normalize unknown kinds to companion', () => {
    expect(normalizeAssistantKind(null)).toBe('companion')
    expect(normalizeAssistantKind('work')).toBe('work')
  })
})
