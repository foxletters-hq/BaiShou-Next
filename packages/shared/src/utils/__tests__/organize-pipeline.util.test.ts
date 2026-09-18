import { describe, expect, it } from 'vitest'
import {
  listRunnableOrganizePhases,
  organizePhaseOrder,
  runOrganizePhases
} from '../organize-pipeline.util'
import { RAG_BATCH_EMBED_PHASE_IDS } from '../rag-batch-embed-progress.util'

const empty = {
  diaries: 0,
  memories: 0,
  graphNodes: 0,
  knowledgeSources: 0,
  notebookGraphNodes: 0,
  graphExtract: 0,
  graphDisambiguate: 0
}

const NEW_PHASE_ORDER = [
  'diary',
  'memory',
  'knowledge',
  'graph_extract',
  'graph_node',
  'graph_disambiguate'
] as const

describe('organize-pipeline', () => {
  it('should keep knowledge then extract then graph_node when listing shared phase order', () => {
    expect(organizePhaseOrder()).toEqual([...NEW_PHASE_ORDER])
  })

  it('should match organizePhaseOrder when reading RAG_BATCH_EMBED_PHASE_IDS', () => {
    expect(RAG_BATCH_EMBED_PHASE_IDS).toEqual(organizePhaseOrder())
  })

  it('should list leftover phases in shared order when some counts are zero', () => {
    expect(
      listRunnableOrganizePhases({
        ...empty,
        memories: 1,
        knowledgeSources: 2,
        graphExtract: 4,
        graphDisambiguate: 1
      })
    ).toEqual(['memory', 'knowledge', 'graph_extract', 'graph_disambiguate'])
  })

  it('should list knowledge extract then graph_node when every phase has leftover work', () => {
    expect(
      listRunnableOrganizePhases({
        ...empty,
        diaries: 1,
        memories: 1,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 1,
        graphDisambiguate: 1
      })
    ).toEqual([...NEW_PHASE_ORDER])
  })

  it('should fold notebook graph nodes into graph_node when only notebook nodes remain', () => {
    expect(
      listRunnableOrganizePhases({
        ...empty,
        notebookGraphNodes: 3
      })
    ).toEqual(['graph_node'])
  })

  it('should return no phases when every count is zero', () => {
    expect(listRunnableOrganizePhases(empty)).toEqual([])
  })

  it('should run graph_extract when only extract remains', async () => {
    const result = await runOrganizePhases({
      input: { ...empty, graphExtract: 1 },
      runPhase: async () => undefined
    })
    expect(result).toEqual({ ran: ['graph_extract'], abortedAt: null })
  })

  it('should run leftover phases in shared order when every count is positive', async () => {
    const result = await runOrganizePhases({
      input: {
        ...empty,
        diaries: 1,
        memories: 1,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 2,
        graphDisambiguate: 1
      },
      runPhase: async () => undefined
    })
    expect(result.ran).toEqual([...NEW_PHASE_ORDER])
  })

  it('should abort at knowledge when stopping after two phases', async () => {
    let calls = 0
    const interrupted = await runOrganizePhases({
      input: {
        ...empty,
        diaries: 1,
        memories: 1,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 2
      },
      runPhase: async () => {
        calls += 1
      },
      shouldContinue: () => calls < 2
    })
    expect(interrupted.abortedAt).toBe('knowledge')
  })

  it('should keep diary and memory in ran when aborting before knowledge', async () => {
    let calls = 0
    const interrupted = await runOrganizePhases({
      input: {
        ...empty,
        diaries: 1,
        memories: 1,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 2
      },
      runPhase: async () => {
        calls += 1
      },
      shouldContinue: () => calls < 2
    })
    expect(interrupted.ran).toEqual(['diary', 'memory'])
  })

  it('should resume leftover phases in shared order when recounting after interrupt', async () => {
    const resumed = await runOrganizePhases({
      input: {
        ...empty,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 2,
        graphDisambiguate: 1
      },
      runPhase: async () => undefined
    })
    expect(resumed.ran).toEqual(['knowledge', 'graph_extract', 'graph_node', 'graph_disambiguate'])
  })
})
