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
  graphExtract: 0
}

describe('organize-pipeline', () => {
  it('should keep extract after the four embed types', () => {
    expect(organizePhaseOrder()).toEqual([
      'diary',
      'memory',
      'graph_node',
      'knowledge',
      'graph_extract'
    ])
    expect(RAG_BATCH_EMBED_PHASE_IDS).toEqual(organizePhaseOrder())
  })

  it('should list only phases that still have work, in order', () => {
    expect(
      listRunnableOrganizePhases({
        ...empty,
        memories: 1,
        knowledgeSources: 2,
        graphExtract: 4
      })
    ).toEqual(['memory', 'knowledge', 'graph_extract'])
  })

  it('should fold notebook graph nodes into the graph_node phase', () => {
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

  it('should run a single remaining phase', async () => {
    const ran: string[] = []
    const result = await runOrganizePhases({
      input: { ...empty, graphExtract: 1 },
      runPhase: async (id) => {
        ran.push(id)
      }
    })
    expect(result).toEqual({ ran: ['graph_extract'], abortedAt: null })
    expect(ran).toEqual(['graph_extract'])
  })

  it('should run remaining phases after an interrupt by recounting leftover work', async () => {
    const first = await runOrganizePhases({
      input: {
        ...empty,
        diaries: 1,
        memories: 1,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 2
      },
      runPhase: async () => undefined,
      shouldContinue: () => true
    })
    expect(first.ran).toEqual(['diary', 'memory', 'graph_node', 'knowledge', 'graph_extract'])

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
    expect(interrupted.abortedAt).toBe('graph_node')

    const resumed = await runOrganizePhases({
      input: {
        ...empty,
        graphNodes: 1,
        knowledgeSources: 1,
        graphExtract: 2
      },
      runPhase: async () => undefined
    })
    expect(resumed.ran).toEqual(['graph_node', 'knowledge', 'graph_extract'])
    expect(resumed.abortedAt).toBeNull()
  })
})
