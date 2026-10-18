import { describe, expect, it } from 'vitest'
import { buildKnowledgeSourceCardMenuActions } from '../knowledge-source-card-menu.util'

describe('buildKnowledgeSourceCardMenuActions', () => {
  it('should keep both previews and delete on a stored source, with embed', () => {
    expect(buildKnowledgeSourceCardMenuActions({ status: 'stored' })).toEqual([
      'preview-original',
      'preview-extracted',
      'embed',
      'delete'
    ])
  })

  it('should include cancel when extracting', () => {
    expect(
      buildKnowledgeSourceCardMenuActions({ status: 'extracting', extractEngine: 'vision' })
    ).toEqual(['preview-original', 'preview-extracted', 'cancel', 'delete'])
  })

  it('should flatten reembed actions on a ready source', () => {
    expect(buildKnowledgeSourceCardMenuActions({ status: 'ready' })).toEqual([
      'preview-original',
      'preview-extracted',
      'reembed-vector',
      'reembed-graph',
      'delete'
    ])
  })
})
