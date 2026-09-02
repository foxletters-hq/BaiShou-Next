import { describe, expect, it } from 'vitest'
import {
  KNOWLEDGE_DIMENSION_MISMATCH,
  KNOWLEDGE_MODEL_MISMATCH,
  MAX_MOUNTED_NOTEBOOKS,
  assertCompatibleNotebookDimensions,
  assertMountedNotebookModelMatch,
  parseMountedNotebookIds,
  resolveWorkspaceNotebookIds,
  serializeMountedNotebookIds
} from '../mounted-notebook.util'

describe('parseMountedNotebookIds', () => {
  it('dedupes, drops empty values, and caps at 3', () => {
    expect(parseMountedNotebookIds(['nb1', 'nb1', '', 'nb2', 'nb3', 'nb4'])).toEqual([
      'nb1',
      'nb2',
      'nb3'
    ])
    expect(parseMountedNotebookIds('["nb-a","nb-b"]')).toEqual(['nb-a', 'nb-b'])
    expect(parseMountedNotebookIds('')).toEqual([])
    expect(parseMountedNotebookIds(null)).toEqual([])
    expect(MAX_MOUNTED_NOTEBOOKS).toBe(3)
  })
})

describe('serializeMountedNotebookIds', () => {
  it('round-trips an array as JSON and empty as blank', () => {
    expect(serializeMountedNotebookIds(['nb1', 'nb2'])).toBe('["nb1","nb2"]')
    expect(parseMountedNotebookIds(serializeMountedNotebookIds(['nb1', 'nb2']))).toEqual([
      'nb1',
      'nb2'
    ])
    expect(serializeMountedNotebookIds([])).toBe('')
  })
})

describe('resolveWorkspaceNotebookIds', () => {
  it('reads notebookIds only', () => {
    expect(resolveWorkspaceNotebookIds({ notebookIds: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(resolveWorkspaceNotebookIds({})).toEqual([])
  })
})

describe('assertCompatibleNotebookDimensions', () => {
  it('throws knowledge-dimension-mismatch when two mounted notebooks differ', () => {
    expect(() =>
      assertCompatibleNotebookDimensions([
        { notebookId: 'nb1', notebookName: '制度', dimension: 1024, modelId: 'm', chunkCount: 3 },
        { notebookId: 'nb2', notebookName: '手册', dimension: 768, modelId: 'm', chunkCount: 2 }
      ])
    ).toThrow(/knowledge-dimension-mismatch/)
    expect(() =>
      assertCompatibleNotebookDimensions([
        { notebookId: 'nb1', notebookName: '制度', dimension: 1024, modelId: 'm', chunkCount: 3 },
        { notebookId: 'nb2', notebookName: '手册', dimension: 768, modelId: 'm', chunkCount: 2 }
      ])
    ).toThrow(/制度（1024 维）/)
    expect(() =>
      assertCompatibleNotebookDimensions([
        { notebookId: 'nb1', notebookName: '制度', dimension: 1024, modelId: 'm', chunkCount: 3 },
        { notebookId: 'nb2', notebookName: '手册', dimension: 768, modelId: 'm', chunkCount: 2 }
      ])
    ).toThrow(/手册（768 维）/)
  })

  it('throws when a single notebook has mixed dimensions', () => {
    expect(() =>
      assertCompatibleNotebookDimensions([
        { notebookId: 'nb1', notebookName: '制度', dimension: 1024, modelId: 'm1', chunkCount: 2 },
        { notebookId: 'nb1', notebookName: '制度', dimension: 768, modelId: 'm2', chunkCount: 1 }
      ])
    ).toThrow(new RegExp(KNOWLEDGE_DIMENSION_MISMATCH))
  })

  it('allows matching dimensions and skips empty notebooks', () => {
    expect(
      assertCompatibleNotebookDimensions([
        { notebookId: 'nb1', dimension: 1024, modelId: 'm', chunkCount: 4 },
        { notebookId: 'nb2', dimension: 1024, modelId: 'm', chunkCount: 1 },
        { notebookId: 'nb3', dimension: 768, modelId: 'other', chunkCount: 0 }
      ])
    ).toEqual({ dimension: 1024 })
    expect(assertCompatibleNotebookDimensions([])).toBeNull()
  })
})

describe('assertMountedNotebookModelMatch', () => {
  it('throws when a mounted notebook uses another embedding model', () => {
    expect(() =>
      assertMountedNotebookModelMatch(
        [{ notebookId: 'nb1', dimension: 1024, modelId: 'old', chunkCount: 2 }],
        'current'
      )
    ).toThrow(KNOWLEDGE_MODEL_MISMATCH)
  })

  it('ignores empty notebooks and missing current model', () => {
    expect(() =>
      assertMountedNotebookModelMatch(
        [{ notebookId: 'nb1', dimension: 1024, modelId: 'old', chunkCount: 0 }],
        'current'
      )
    ).not.toThrow()
    expect(() =>
      assertMountedNotebookModelMatch(
        [{ notebookId: 'nb1', dimension: 1024, modelId: 'old', chunkCount: 2 }],
        ''
      )
    ).not.toThrow()
  })
})
