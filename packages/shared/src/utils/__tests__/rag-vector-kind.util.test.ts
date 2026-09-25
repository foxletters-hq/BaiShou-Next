import { describe, expect, it } from 'vitest'
import {
  graphNodeEmbeddingId,
  isGraphNodeRagEntry,
  parseGraphNodeEmbeddingId,
  ragVectorKindLabelKey,
  RAG_VECTOR_KIND_FILTERS,
  RAG_VECTOR_KINDS,
  resolveRagVectorKind
} from '../rag-vector-kind.util'

describe('resolveRagVectorKind', () => {
  it('classifies diary, partner, manual and graph node', () => {
    expect(resolveRagVectorKind({ sourceType: 'diary' })).toBe('diary')
    expect(resolveRagVectorKind({ sourceType: 'memory', isManual: false })).toBe('partner')
    expect(resolveRagVectorKind({ sourceType: 'memory', isManual: true })).toBe('manual')
    expect(resolveRagVectorKind({ sourceType: 'manual' })).toBe('manual')
    expect(resolveRagVectorKind({ sourceType: 'graph_node' })).toBe('graph_node')
    expect(resolveRagVectorKind({ sourceType: 'chat' })).toBeNull()
  })
})

describe('graph node embedding id', () => {
  it('round-trips node id', () => {
    expect(parseGraphNodeEmbeddingId(graphNodeEmbeddingId('n1'))).toBe('n1')
    expect(isGraphNodeRagEntry('graph_node')).toBe(true)
    expect(parseGraphNodeEmbeddingId('mem-1')).toBeNull()
  })
})

describe('ragVectorKindLabelKey', () => {
  it('maps filter to i18n keys', () => {
    expect(ragVectorKindLabelKey('all')).toBe('settings.rag_filter_all')
    expect(ragVectorKindLabelKey('graph_node')).toBe('settings.rag_source_node')
  })
})

describe('RAG_VECTOR_KIND_FILTERS', () => {
  it('should list all, diary, node, partner, then manual', () => {
    expect(RAG_VECTOR_KINDS).toEqual(['diary', 'graph_node', 'partner', 'manual'])
    expect(RAG_VECTOR_KIND_FILTERS).toEqual(['all', 'diary', 'graph_node', 'partner', 'manual'])
  })
})
