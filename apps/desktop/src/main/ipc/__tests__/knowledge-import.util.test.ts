import { describe, expect, it } from 'vitest'
import { resolveKnowledgeImportDefer } from '../knowledge-import.util'

describe('resolveKnowledgeImportDefer', () => {
  it('should defer later, none, and save-only raw modes', () => {
    expect(resolveKnowledgeImportDefer('later').deferOrganize).toBe(true)
    expect(resolveKnowledgeImportDefer('none').deferOrganize).toBe(true)
    expect(resolveKnowledgeImportDefer('save-only').deferOrganize).toBe(true)
  })

  it('should not defer both or vector', () => {
    expect(resolveKnowledgeImportDefer('both')).toEqual({
      importProcessMode: 'both',
      deferOrganize: false
    })
    expect(resolveKnowledgeImportDefer('vector')).toEqual({
      importProcessMode: 'vector',
      deferOrganize: false
    })
  })
})
