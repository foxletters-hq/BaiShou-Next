import { describe, expect, it } from 'vitest'
import { isKnowledgeNotebookTab } from '../knowledge-notebook-tab.util'

describe('knowledge-notebook-tab.util', () => {
  it('accepts the three notebook pages', () => {
    expect(isKnowledgeNotebookTab('sources')).toBe(true)
    expect(isKnowledgeNotebookTab('graph')).toBe(true)
    expect(isKnowledgeNotebookTab('vectors')).toBe(true)
    expect(isKnowledgeNotebookTab('chat')).toBe(false)
  })

  it('rejects unknown values', () => {
    expect(isKnowledgeNotebookTab('studio')).toBe(false)
    expect(isKnowledgeNotebookTab('')).toBe(false)
  })
})
