import { describe, it, expect } from 'vitest'
import {
  getAssistantDisabledToolIds,
  mergeDisabledToolIds,
  normalizeAssistantKind,
  resolveSessionDisabledToolIds
} from '../assistant-kind.constants'

describe('assistant-kind.constants', () => {
  it('should disable diary and memory tools for work assistants', () => {
    const ids = getAssistantDisabledToolIds('work')
    expect(ids).toContain('diary_edit')
    expect(ids).toContain('summary_read')
    expect(ids).toContain('vector_search')
    expect(ids).not.toContain('web_search')
  })

  it('should disable graph tools for work assistants (G1.d)', () => {
    const ids = getAssistantDisabledToolIds('work')
    expect(ids).toContain('graph_upsert')
    expect(ids).toContain('recall_relations')
  })

  it('should not add extra disabled tools for companion assistants', () => {
    expect(getAssistantDisabledToolIds('companion')).toEqual([])
  })

  it('should merge global and assistant disabled tool ids', () => {
    const merged = mergeDisabledToolIds(['web_search'], 'work')
    expect(merged).toContain('web_search')
    expect(merged).toContain('diary_write')
  })

  it('does not add work-assistant disables in workspace sessions', () => {
    const ids = resolveSessionDisabledToolIds(['workspace_run'], 'work', 'workspace')
    expect(ids).toEqual(['workspace_run'])
    expect(ids).not.toContain('diary_read')
    expect(ids).not.toContain('vector_search')
  })

  it('still merges work-assistant disables in companion sessions', () => {
    const ids = resolveSessionDisabledToolIds(['web_search'], 'work', 'companion')
    expect(ids).toContain('web_search')
    expect(ids).toContain('diary_read')
  })

  it('should normalize unknown kinds to companion', () => {
    expect(normalizeAssistantKind(null)).toBe('companion')
    expect(normalizeAssistantKind('work')).toBe('work')
  })
})
