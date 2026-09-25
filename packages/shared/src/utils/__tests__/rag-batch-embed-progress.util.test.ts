import { describe, expect, it } from 'vitest'
import {
  applyFrozenPhaseProgress,
  firstActivePhase,
  markPhaseDone,
  overallFromPhaseCounts,
  phaseCountsFromPending,
  MEMORY_ORGANIZE_PHASE_IDS,
  RAG_BATCH_EMBED_PHASE_IDS,
  resolvePhaseRowStatus
} from '../rag-batch-embed-progress.util'

describe('rag-batch-embed-progress', () => {
  it('should keep knowledge in the shared id union but omit it from memory organize phases', () => {
    expect(RAG_BATCH_EMBED_PHASE_IDS).toEqual([
      'diary',
      'memory',
      'knowledge',
      'graph_extract',
      'graph_node',
      'graph_disambiguate'
    ])
    expect(MEMORY_ORGANIZE_PHASE_IDS).toEqual([
      'diary',
      'memory',
      'graph_extract',
      'graph_node',
      'graph_disambiguate'
    ])
  })

  it('should return memory when memories remain even if graph nodes remain', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 1,
        graphNodes: 328,
        knowledgeSources: 0
      })
    ).toBe('memory')
  })

  it('should skip knowledge leftovers when choosing the next memory organize phase', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 8,
        knowledgeSources: 2,
        graphExtract: 3
      })
    ).toBe('graph_extract')
  })

  it('should return graph_extract when extract and graph nodes both have work', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 8,
        knowledgeSources: 0,
        graphExtract: 3
      })
    ).toBe('graph_extract')
  })

  it('should return graph_extract when only extract remains', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 0,
        knowledgeSources: 0,
        graphExtract: 5
      })
    ).toBe('graph_extract')
  })

  it('should finish when only notebook leftovers remain', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 0,
        knowledgeSources: 2,
        notebookGraphNodes: 2
      })
    ).toBe('finishing')
  })

  it('should return graph_disambiguate when only disambiguate remains', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 0,
        knowledgeSources: 0,
        graphDisambiguate: 2
      })
    ).toBe('graph_disambiguate')
  })

  it('should return finishing when every count is zero', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 0,
        knowledgeSources: 0
      })
    ).toBe('finishing')
  })

  it('should skip knowledge when current phase is graph_node', () => {
    const phases = phaseCountsFromPending({
      diaries: 0,
      memories: 0,
      graphNodes: 2,
      knowledgeSources: 3,
      graphExtract: 1
    })
    expect(resolvePhaseRowStatus('knowledge', 'graph_node', phases.knowledgeSources)).toBe(
      'skipped'
    )
  })

  it('should mark graph_extract done when current phase is graph_node', () => {
    const phases = phaseCountsFromPending({
      diaries: 0,
      memories: 0,
      graphNodes: 2,
      knowledgeSources: 0,
      graphExtract: 1
    })
    expect(resolvePhaseRowStatus('graph_extract', 'graph_node', phases.graphExtract)).toBe('done')
  })

  it('should mark earlier types done when current type is running', () => {
    const phases = markPhaseDone(
      markPhaseDone(
        phaseCountsFromPending({
          diaries: 0,
          memories: 1,
          graphNodes: 328,
          knowledgeSources: 0
        }),
        'diary'
      ),
      'memory'
    )
    phases.graphNodes.completed = 12
    expect(resolvePhaseRowStatus('memory', 'graph_node', phases.memories)).toBe('done')
  })

  it('should skip diary when diary total is zero and graph_node is current', () => {
    const phases = phaseCountsFromPending({
      diaries: 0,
      memories: 1,
      graphNodes: 328,
      knowledgeSources: 0
    })
    expect(resolvePhaseRowStatus('diary', 'graph_node', phases.diaries)).toBe('skipped')
  })

  it('should keep planned diary total fixed when completed increases', () => {
    let phases = phaseCountsFromPending({
      diaries: 1,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0
    })
    phases = applyFrozenPhaseProgress(phases, 'diary', { completed: 0, total: 1 })
    phases = applyFrozenPhaseProgress(phases, 'diary', { completed: 1, total: 1 })
    expect(phases.diaries).toEqual({ completed: 1, total: 1 })
  })

  it('should clamp diary completed to planned total when reported completed exceeds total', () => {
    let phases = phaseCountsFromPending({
      diaries: 1,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0
    })
    phases = applyFrozenPhaseProgress(phases, 'diary', { completed: 80, total: 1 })
    expect(phases.diaries).toEqual({ completed: 1, total: 1 })
  })

  it('should sum overall progress when embed types and graph extract have counts', () => {
    expect(
      overallFromPhaseCounts({
        diaries: { completed: 0, total: 0 },
        memories: { completed: 1, total: 1 },
        graphNodes: { completed: 12, total: 328 },
        knowledgeSources: { completed: 0, total: 0 },
        graphExtract: { completed: 2, total: 5 },
        graphDisambiguate: { completed: 1, total: 2 }
      })
    ).toEqual({ completed: 16, total: 336 })
  })

  it('should keep notebook leftovers out of memory organize phase totals', () => {
    expect(
      phaseCountsFromPending({
        diaries: 0,
        memories: 0,
        graphNodes: 2,
        knowledgeSources: 5,
        notebookGraphNodes: 4,
        graphExtract: 3
      })
    ).toEqual({
      diaries: { completed: 0, total: 0 },
      memories: { completed: 0, total: 0 },
      graphNodes: { completed: 0, total: 2 },
      knowledgeSources: { completed: 0, total: 0 },
      graphExtract: { completed: 0, total: 3 },
      graphDisambiguate: { completed: 0, total: 0 }
    })
  })
})
