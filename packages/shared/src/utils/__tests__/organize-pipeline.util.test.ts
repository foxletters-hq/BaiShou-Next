import { describe, expect, it } from 'vitest'
import {
  listRunnableOrganizePhases,
  organizePhaseOrder,
  runOrganizePhases
} from '../organize-pipeline.util'
import { MEMORY_ORGANIZE_PHASE_IDS } from '../rag-batch-embed-progress.util'

const empty = {
  diaries: 0,
  memories: 0,
  graphNodes: 0,
  knowledgeSources: 0,
  notebookGraphNodes: 0,
  graphExtract: 0,
  graphDisambiguate: 0
}

const MEMORY_PHASE_ORDER = [
  'diary',
  'memory',
  'graph_extract',
  'graph_node',
  'graph_disambiguate'
] as const

describe('organize-pipeline', () => {
  it('should list extract then graph_node when listing memory organize phase order', () => {
    expect(organizePhaseOrder()).toEqual([...MEMORY_PHASE_ORDER])
  })

  it('should match organizePhaseOrder when reading MEMORY_ORGANIZE_PHASE_IDS', () => {
    expect(MEMORY_ORGANIZE_PHASE_IDS).toEqual(organizePhaseOrder())
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
    ).toEqual(['memory', 'graph_extract', 'graph_disambiguate'])
  })

  it('should list memory extract then graph_node when every memory phase has leftover work', () => {
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
    ).toEqual(['diary', 'memory', 'graph_extract', 'graph_node', 'graph_disambiguate'])
  })

  it('should ignore notebook graph nodes when listing memory organize phases', () => {
    expect(
      listRunnableOrganizePhases({
        ...empty,
        notebookGraphNodes: 3
      })
    ).toEqual([])
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

  it('should run leftover memory phases without knowledge when every count is positive', async () => {
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
    expect(result.ran).toEqual(['diary', 'memory', 'graph_extract', 'graph_node', 'graph_disambiguate'])
  })

  it('should abort at graph_extract when stopping after two phases', async () => {
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
    expect(interrupted.abortedAt).toBe('graph_extract')
  })

  it('should keep diary and memory in ran when aborting before graph extract', async () => {
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
    expect(resumed.ran).toEqual(['graph_extract', 'graph_node', 'graph_disambiguate'])
  })
})
