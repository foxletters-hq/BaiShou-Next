import { describe, expect, it } from 'vitest'
import { resolveGlobalGraphModelIds } from '../global-graph-model.util'
import { buildMemoryReadinessRows, memoryReadinessNeedsBelowTitle } from '../memory-readiness.util'

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

  it('uses only the graph slot for the extract model id', () => {
    const models = {
      globalDialogueProviderId: 'gemini',
      globalDialogueModelId: 'gemini-pro',
      globalGraphProviderId: 'deepseek',
      globalGraphModelId: 'deepseek-chat',
      globalEmbeddingModelId: 'text-embedding-3-small'
    }
    const rows = buildMemoryReadinessRows({
      globalModels: models,
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 0,
      pendingGraphCount: 0
    })
    expect(rows[1]?.state).toBe('ready')
    expect(rows[1]?.modelId).toBe(resolveGlobalGraphModelIds(models).modelId)
    expect(rows[1]?.modelId).toBe('deepseek-chat')
  })

  it('marks extract missing when only the dialogue model is configured', () => {
    const rows = buildMemoryReadinessRows({
      globalModels: {
        globalDialogueProviderId: 'gemini',
        globalDialogueModelId: 'gemini-pro',
        globalEmbeddingModelId: 'text-embedding-3-small'
      },
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 0,
      pendingGraphCount: 0
    })
    expect(rows[1]).toMatchObject({ id: 'extract', state: 'missing' })
  })
})

describe('memoryReadinessNeedsBelowTitle', () => {
  const readyRows = buildMemoryReadinessRows({
    globalModels: EMBEDDED,
    ragConfig: { ragEnabled: true },
    unindexedDiaryCount: 0,
    pendingGraphCount: 0
  })
  const pendingRows = buildMemoryReadinessRows({
    globalModels: EMBEDDED,
    ragConfig: { ragEnabled: true },
    unindexedDiaryCount: 3,
    pendingGraphCount: 0
  })

  it('keeps the ready badge on the title row when visible rows are ready', () => {
    expect(
      memoryReadinessNeedsBelowTitle(readyRows, { omit: ['extract', 'embedding', 'graph'] })
    ).toBe(false)
  })

  it('moves pending or indexing status below the title', () => {
    expect(
      memoryReadinessNeedsBelowTitle(pendingRows, { omit: ['extract', 'embedding', 'graph'] })
    ).toBe(true)
    expect(
      memoryReadinessNeedsBelowTitle(readyRows, {
        omit: ['extract', 'embedding', 'graph'],
        indexing: true
      })
    ).toBe(true)
  })

  it('ignores omitted pending rows', () => {
    const graphPending = buildMemoryReadinessRows({
      globalModels: EMBEDDED,
      ragConfig: { ragEnabled: true },
      unindexedDiaryCount: 0,
      pendingGraphCount: 2
    })
    expect(
      memoryReadinessNeedsBelowTitle(graphPending, { omit: ['extract', 'embedding', 'graph'] })
    ).toBe(false)
  })
})
