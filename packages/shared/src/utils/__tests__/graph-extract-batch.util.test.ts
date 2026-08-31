import { describe, expect, it } from 'vitest'
import {
  GRAPH_EXTRACT_ALIGN_POOL_SIZE,
  GRAPH_EXTRACT_CONCURRENCY_DEFAULT,
  GRAPH_EXTRACT_CONCURRENCY_MAX,
  GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR,
  buildGraphExtractEnqueueItems,
  entityAlignKey,
  graphCosineDistanceToSimilarity,
  isDiaryEmbeddingPresent,
  isGraphExtractBusyStatus,
  resolveGraphExtractConcurrency,
  graphExtractOverallProgress,
  graphExtractBarPercent,
  graphExtractPhaseProgress,
  describeGraphExtractPhase,
  describeGraphExtractQueueError
} from '../graph-extract-batch.util'

describe('resolveGraphExtractConcurrency', () => {
  it('defaults to 5 and clamps to 1–10', () => {
    expect(resolveGraphExtractConcurrency(undefined)).toBe(GRAPH_EXTRACT_CONCURRENCY_DEFAULT)
    expect(resolveGraphExtractConcurrency(5)).toBe(5)
    expect(resolveGraphExtractConcurrency(0)).toBe(1)
    expect(resolveGraphExtractConcurrency(99)).toBe(GRAPH_EXTRACT_CONCURRENCY_MAX)
    expect(resolveGraphExtractConcurrency('3')).toBe(3)
  })
})

describe('graph extract pool and distance', () => {
  it('keeps the align pool at 10 and converts cosine distance', () => {
    expect(GRAPH_EXTRACT_ALIGN_POOL_SIZE).toBe(10)
    expect(graphCosineDistanceToSimilarity(0.49)).toBeCloseTo(0.51)
    expect(graphCosineDistanceToSimilarity(0.5)).toBeCloseTo(0.5)
  })
})

describe('buildGraphExtractEnqueueItems', () => {
  it('normalizes paths and skips diaries that are not embedded', async () => {
    const result = await buildGraphExtractEnqueueItems({
      wanted: ['Journal\\a.md', 'Journal/b.md'],
      pending: [{ filePath: 'Journal/a.md', date: '2026-03-15' }],
      isDiaryEmbedded: (filePath) => filePath.endsWith('a.md')
    })
    expect(result.items).toEqual([{ filePath: 'Journal/a.md', date: '2026-03-15' }])
    expect(result.skippedNotEmbedded).toEqual(['Journal/b.md'])
  })
})

describe('entityAlignKey', () => {
  it('normalizes type and name', () => {
    expect(entityAlignKey('Person', '  小明  ')).toBe(entityAlignKey('person', '小明'))
  })
})

describe('graph extract gates', () => {
  it('treats aligning as busy', () => {
    expect(isGraphExtractBusyStatus('aligning')).toBe(true)
    expect(isGraphExtractBusyStatus('completed')).toBe(false)
  })

  it('accepts scoped and legacy diary embedding ids', () => {
    const scoped = new Set(['vlt_abc#12'])
    expect(isDiaryEmbeddingPresent('vlt_abc', 12, scoped)).toBe(true)
    expect(isDiaryEmbeddingPresent('vlt_abc', 12, new Set(['12']))).toBe(true)
    expect(isDiaryEmbeddingPresent('vlt_abc', 13, scoped)).toBe(false)
  })
})

describe('graph extract progress copy', () => {
  it('maps each extract phase to a fixed bar percent', () => {
    expect(graphExtractPhaseProgress('reading')).toBe(12)
    expect(graphExtractPhaseProgress('model')).toBe(40)
    expect(graphExtractPhaseProgress('parsing')).toBe(55)
    expect(graphExtractBarPercent({ status: 'running', phase: 'model', progress: 99 })).toBe(40)
    expect(graphExtractBarPercent({ status: 'running', phase: 'waiting_model', progress: 99 })).toBe(
      40
    )
  })

  it('averages item progress for the overall bar', () => {
    expect(
      graphExtractOverallProgress([
        { status: 'completed', progress: 100 },
        { status: 'running', progress: 40 },
        { status: 'pending', progress: 0 }
      ])
    ).toBe(47)
  })

  it('describes waiting-pool and streaming phases', () => {
    expect(
      describeGraphExtractPhase({ status: 'aligning', phase: 'waiting_pool', phaseDetail: '3/10' })
    ).toMatchObject({
      key: 'graph.queue_phase_waiting_pool',
      params: { detail: '3/10' }
    })
    expect(
      describeGraphExtractPhase({ status: 'running', phase: 'streaming', phaseDetail: '80' })
    ).toMatchObject({
      key: 'graph.queue_phase_model'
    })
    expect(describeGraphExtractPhase({ status: 'running', phase: 'waiting_model' })).toMatchObject({
      key: 'graph.queue_phase_model'
    })
    expect(describeGraphExtractPhase({ status: 'running', phase: 'thinking', phaseDetail: '32' })).toMatchObject({
      key: 'graph.queue_phase_model'
    })
    expect(describeGraphExtractPhase({ status: 'running' })).toMatchObject({
      key: 'graph.queue_phase_model'
    })
  })

  it('describes empty-response and parse errors', () => {
    expect(describeGraphExtractQueueError('LLM returned empty response')).toMatchObject({
      key: 'graph.extract_empty_response'
    })
    expect(describeGraphExtractQueueError(GRAPH_EXTRACT_EMPTY_RESPONSE_ERROR)).toMatchObject({
      key: 'graph.extract_empty_response'
    })
    expect(describeGraphExtractQueueError('Failed to parse LLM JSON')).toMatchObject({
      key: 'graph.extract_parse_failed'
    })
    expect(describeGraphExtractQueueError('upstream 500')).toMatchObject({
      key: 'graph.queue_error_message',
      params: { message: 'upstream 500' }
    })
  })
})
