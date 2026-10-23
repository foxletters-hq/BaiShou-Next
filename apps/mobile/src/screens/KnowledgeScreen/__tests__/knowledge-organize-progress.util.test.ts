import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLatestThrottled,
  knowledgeOrganizeBannerProgress,
  knowledgeOrganizeDetailSources,
  knowledgeOrganizeFailedMessage,
  knowledgeOrganizeProcessLines,
  knowledgeOrganizeRememberedTotal,
  knowledgeOrganizeRestartTarget,
  knowledgeOrganizeSourcePhases,
  knowledgeOrganizeTaskActions,
  overlayOrganizeJobsLiveStatus
} from '../knowledge-organize-banner.util'

describe('knowledgeOrganizeBannerProgress', () => {
  it('should remember the batch total while remaining sources drop out', () => {
    expect(knowledgeOrganizeRememberedTotal(5, 3, true)).toBe(5)
    expect(knowledgeOrganizeRememberedTotal(0, 4, true)).toBe(4)
    expect(knowledgeOrganizeRememberedTotal(5, 0, false)).toBe(0)
  })

  it('should count finished sources and current phase fraction as overall progress', () => {
    const progress = knowledgeOrganizeBannerProgress({
      knownTotal: 5,
      sources: [
        {
          sourceId: 'a',
          title: '讲义',
          phases: [
            { id: 'extract', status: 'done', completed: 0, total: 0 },
            { id: 'embed', status: 'running', completed: 12, total: 48 },
            { id: 'graph', status: 'pending', completed: 0, total: 0 }
          ]
        }
      ]
    })
    expect(progress).toEqual({
      done: 4,
      total: 5,
      percent: 88
    })
  })

  it('should put window counts on the compact process line', () => {
    const lines = knowledgeOrganizeProcessLines({
      watching: true,
      sources: [{ id: 'a', title: '讲义', status: 'ready' }],
      graphJobItems: [
        {
          sourceId: 'a',
          title: '讲义',
          status: 'running',
          stage: 'graph',
          windowsDone: 3,
          windowsTotal: 20
        }
      ],
      ingestJobItems: [],
      ocrProgressBySource: {}
    })
    expect(lines).toEqual([
      {
        sourceId: 'a',
        title: '讲义',
        phase: 'graph',
        status: 'running',
        detail: '3/20',
        completed: 3,
        total: 20
      }
    ])
  })
})

describe('knowledgeOrganizeDetailSources', () => {
  it('should keep stored sources in the detail list while organize is watching', () => {
    const rows = knowledgeOrganizeDetailSources({
      watching: true,
      sources: [{ id: 'a', title: '笔记', status: 'stored' }],
      graphJobItems: [],
      ingestJobItems: [],
      ocrProgressBySource: {}
    })
    expect(rows.map((row) => row.sourceId)).toEqual(['a'])
  })

  it('should omit idle stored sources from leftover details', () => {
    expect(
      knowledgeOrganizeDetailSources({
        sources: [{ id: 'a', title: '笔记', status: 'stored' }],
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toEqual([])
  })

  it('should keep a missing text-layer note as a hint instead of a failed error', () => {
    const rows = knowledgeOrganizeDetailSources({
      watching: true,
      sources: [
        {
          id: 'a',
          title: '讲义',
          status: 'extracting',
          errorMessage: '112 页中有 98 页没有文本层'
        }
      ],
      graphJobItems: [],
      ingestJobItems: [{ sourceId: 'a', title: '讲义', status: 'running', stage: 'extract' }],
      ocrProgressBySource: {}
    })
    expect(rows).toEqual([
      expect.objectContaining({
        sourceId: 'a',
        error: undefined,
        hint: '112 页中有 98 页没有文本层'
      })
    ])
    expect(knowledgeOrganizeFailedMessage(rows)).toBeUndefined()
  })

  it('should pick the failed source error for the compact banner', () => {
    expect(
      knowledgeOrganizeFailedMessage([
        {
          sourceId: 'ok',
          title: '完成',
          phases: [{ id: 'extract', status: 'done', completed: 0, total: 0 }]
        },
        {
          sourceId: 'bad',
          title: '笔记',
          error: 'graph-step:extract:Insufficient Balance',
          phases: [{ id: 'graph', status: 'failed', completed: 0, total: 0 }]
        }
      ])
    ).toBe('graph-step:extract:Insufficient Balance')
  })

  it('should omit a ready source that only has leftover embed progress', () => {
    expect(
      knowledgeOrganizeDetailSources({
        sources: [{ id: 'a', title: '笔记', status: 'ready' }],
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: { a: { page: 1, total: 1, phase: 'embed' } }
      })
    ).toEqual([])
  })
})

describe('knowledgeOrganizeTaskActions', () => {
  it('should offer restart and cancel while embedding is still running', () => {
    const phases = knowledgeOrganizeSourcePhases({
      sourceStatus: 'embedding',
      embedJobStatus: 'running',
      ingestProgress: { page: 3, total: 10, phase: 'embed' }
    })
    expect(knowledgeOrganizeRestartTarget(phases)).toBe('embed')
    expect(knowledgeOrganizeTaskActions(phases)).toEqual(['restart', 'cancel'])
  })

  it('should offer only restart when the current phase failed', () => {
    expect(
      knowledgeOrganizeTaskActions([
        { id: 'extract', status: 'done', completed: 0, total: 0 },
        { id: 'embed', status: 'failed', completed: 0, total: 0 }
      ])
    ).toEqual(['restart'])
  })

  it('should keep embed restart and cancel after re-entering while embedding is live', () => {
    const sources = knowledgeOrganizeDetailSources({
      watching: false,
      sources: [{ id: 'a', title: '笔记', status: 'embedding' }],
      graphJobItems: [],
      ingestJobItems: [{ sourceId: 'a', title: '笔记', stage: 'embed', status: 'running' }],
      ocrProgressBySource: { a: { page: 2, total: 8, phase: 'embed' } }
    })
    expect(sources).toHaveLength(1)
    expect(knowledgeOrganizeRestartTarget(sources[0]!.phases)).toBe('embed')
    expect(knowledgeOrganizeTaskActions(sources[0]!.phases)).toEqual(['restart', 'cancel'])
  })
})

describe('createLatestThrottled', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should keep only the latest value until the wait elapses', () => {
    vi.useFakeTimers()
    const received: number[] = []
    const throttled = createLatestThrottled(200, (value: number) => {
      received.push(value)
    })
    throttled.push(1)
    throttled.push(2)
    throttled.push(3)
    expect(received).toEqual([])
    vi.advanceTimersByTime(200)
    expect(received).toEqual([3])
  })
})

describe('overlayOrganizeJobsLiveStatus', () => {
  it('should keep claimed jobs running when a stale snapshot still says pending', () => {
    expect(
      overlayOrganizeJobsLiveStatus([{ sourceId: 'a', status: 'pending', stage: 'extract' }], ['a'])
    ).toEqual([{ sourceId: 'a', status: 'running', stage: 'extract' }])
  })

  it('should treat leftover running jobs as paused when the process is no longer live', () => {
    expect(
      overlayOrganizeJobsLiveStatus([{ sourceId: 'a', status: 'running', stage: 'embed' }], [])
    ).toEqual([{ sourceId: 'a', status: 'pending', stage: 'embed' }])
  })
})
