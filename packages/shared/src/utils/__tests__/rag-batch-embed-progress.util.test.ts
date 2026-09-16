import { describe, expect, it } from 'vitest'
import {
  applyFrozenPhaseProgress,
  firstActivePhase,
  markPhaseDone,
  overallFromPhaseCounts,
  phaseCountsFromPending,
  resolvePhaseRowStatus
} from '../rag-batch-embed-progress.util'

describe('rag-batch-embed-progress', () => {
  it('starts at the first type that still has pending items', () => {
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 1,
        graphNodes: 328,
        knowledgeSources: 0
      })
    ).toBe('memory')
    expect(
      firstActivePhase({
        diaries: 0,
        memories: 0,
        graphNodes: 0,
        knowledgeSources: 0
      })
    ).toBe('finishing')
  })

  it('marks earlier types done while the current type is running', () => {
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
    expect(resolvePhaseRowStatus('diary', 'graph_node', phases.diaries)).toBe('skipped')
    expect(resolvePhaseRowStatus('memory', 'graph_node', phases.memories)).toBe('done')
    expect(resolvePhaseRowStatus('graph_node', 'graph_node', phases.graphNodes)).toBe('running')
    expect(resolvePhaseRowStatus('knowledge', 'graph_node', phases.knowledgeSources)).toBe(
      'skipped'
    )
  })

  it('keeps the planned diary total fixed while completed increases', () => {
    let phases = phaseCountsFromPending({
      diaries: 1,
      memories: 0,
      graphNodes: 0,
      knowledgeSources: 0
    })
    phases = applyFrozenPhaseProgress(phases, 'diary', { completed: 0, total: 1 })
    phases = applyFrozenPhaseProgress(phases, 'diary', { completed: 1, total: 1 })
    expect(phases.diaries).toEqual({ completed: 1, total: 1 })
    phases = applyFrozenPhaseProgress(phases, 'diary', { completed: 80, total: 1 })
    expect(phases.diaries).toEqual({ completed: 1, total: 1 })
  })

  it('sums overall progress from the four types', () => {
    expect(
      overallFromPhaseCounts({
        diaries: { completed: 0, total: 0 },
        memories: { completed: 1, total: 1 },
        graphNodes: { completed: 12, total: 328 },
        knowledgeSources: { completed: 0, total: 0 }
      })
    ).toEqual({ completed: 13, total: 329 })
  })
})
