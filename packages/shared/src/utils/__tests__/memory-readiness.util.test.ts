import { describe, expect, it } from 'vitest'
import { resolveGlobalGraphModelIds } from '../global-graph-model.util'
import { buildMemoryReadinessRows } from '../memory-readiness.util'

const EMBEDDED = {
  globalEmbeddingProviderId: 'openai',
  globalEmbeddingModelId: 'text-embedding-3-small',
  globalDialogueProviderId: 'openai',
  globalDialogueModelId: 'gpt-4o'
}

describe('buildMemoryReadinessRows', () => {
  it('returns four rows in embedding / extract / vector / graph order', () => {
    const rows = buildMemoryReadinessRows({
      globalModels: EMBEDDED,
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 0,
      pendingGraphCount: 0
    })
    expect(rows.map((row) => row.id)).toEqual(['embedding', 'extract', 'vector', 'graph'])
  })

  it('blocks vector and graph when the embedding model is missing', () => {
    const rows = buildMemoryReadinessRows({
      globalModels: { globalDialogueModelId: 'gpt-4o' },
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 4,
      pendingGraphCount: 3
    })
    expect(rows[0]).toMatchObject({ id: 'embedding', state: 'missing' })
    expect(rows[2]).toMatchObject({ id: 'vector', state: 'blocked', count: 4 })
    expect(rows[3]).toMatchObject({ id: 'graph', state: 'blocked', count: 3 })
  })

  it('marks vector and graph ready at zero backlog and pending when counts are positive', () => {
    const ready = buildMemoryReadinessRows({
      globalModels: EMBEDDED,
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 0,
      pendingGraphCount: 0
    })
    expect(ready[2]).toMatchObject({ id: 'vector', state: 'ready', count: 0 })
    expect(ready[3]).toMatchObject({ id: 'graph', state: 'ready', count: 0 })

    const pending = buildMemoryReadinessRows({
      globalModels: EMBEDDED,
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 7,
      pendingGraphCount: 2
    })
    expect(pending[2]).toMatchObject({ id: 'vector', state: 'pending', count: 7 })
    expect(pending[3]).toMatchObject({ id: 'graph', state: 'pending', count: 2 })
  })

  it('blocks only vector when rag memory is disabled', () => {
    const rows = buildMemoryReadinessRows({
      globalModels: EMBEDDED,
      ragConfig: { ragEnabled: false },
      unindexedDiaryCount: 5,
      pendingGraphCount: 1
    })
    expect(rows[2]).toMatchObject({ id: 'vector', state: 'blocked', count: 5 })
    expect(rows[3]).toMatchObject({ id: 'graph', state: 'pending', count: 1 })
  })

  it('uses resolveGlobalGraphModelIds for the extract model id', () => {
    const models = {
      globalDialogueProviderId: 'gemini',
      globalDialogueModelId: 'gemini-pro',
      globalEmbeddingModelId: 'text-embedding-3-small'
    }
    const rows = buildMemoryReadinessRows({
      globalModels: models,
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 0,
      pendingGraphCount: 0
    })
    expect(rows[1]?.modelId).toBe(resolveGlobalGraphModelIds(models).modelId)
  })
})
