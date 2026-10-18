import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLatestThrottled,
  knowledgeOrganizeBannerKind,
  knowledgeOrganizeBannerProgress,
  knowledgeOrganizeFailedMessage,
  knowledgeOrganizeDetailSources,
  knowledgeOrganizeProcessLines,
  knowledgeOrganizeRememberedTotal,
  knowledgeOrganizeSourceCount,
  knowledgeOrganizeSourcePhases,
  knowledgeOrganizeRestartTarget,
  knowledgeOrganizeTaskActions,
  overlayOrganizeJobsLiveStatus
} from '../knowledge-organize-banner.util'

describe('knowledgeOrganizeBannerKind', () => {
  it('should show paused when leftover jobs are only queued after restart', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 1,
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe('paused')
  })

  it('should show paused when leftover graph jobs are only queued after restart', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [{ status: 'pending' }],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toBe('paused')
  })

  it('should show running after the user starts organize while jobs are still queued', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: true,
        ingestingCount: 0,
        pendingJobs: 1,
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe('running')
  })

  it('should stay idle when watching but no queued or live work remains', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: true,
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toBe('idle')
  })

  it('should show failed when ingest jobs failed after organize', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: true,
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [{ status: 'failed' }],
        ocrProgressBySource: {}
      })
    ).toBe('failed')
  })

  it('should keep failed leftover jobs visible after restart', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [{ status: 'failed' }],
        ocrProgressBySource: {}
      })
    ).toBe('failed')
  })

  it('should show paused after restart when leftover source is still embedding', () => {
    expect(
      knowledgeOrganizeBannerKind({
        watching: false,
        ingestingCount: 1,
        pendingJobs: 1,
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe('paused')
  })

  it('should stay idle when leftover embed progress belongs to a finished source', () => {
    expect(
      knowledgeOrganizeBannerKind({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: { a: { page: 1, total: 1, phase: 'embed' } }
      })
    ).toBe('idle')
  })

  it('should count ingest jobs when the banner has no graph rows yet', () => {
    expect(
      knowledgeOrganizeSourceCount({
        ingestingCount: 0,
        pendingJobs: 0,
        graphJobItems: [],
        ingestJobItems: [{ sourceId: 'a' }, { sourceId: 'a' }],
        ocrProgressBySource: {}
      })
    ).toBe(1)
  })
})

describe('knowledgeOrganizeSourcePhases', () => {
  it('should keep queued extract waiting until the user starts organize', () => {
    const extract = knowledgeOrganizeSourcePhases({
      sourceStatus: 'pending',
      extractJobStatus: 'pending'
    }).find((phase) => phase.id === 'extract')
    expect(extract?.status).toBe('pending')
  })

  it('should keep queued extract waiting after the user starts organize', () => {
    const extract = knowledgeOrganizeSourcePhases({
      watching: true,
      sourceStatus: 'pending',
      extractJobStatus: 'pending'
    }).find((phase) => phase.id === 'extract')
    expect(extract?.status).toBe('pending')
  })

  it('should keep queued graph and embed waiting instead of marking them running', () => {
    const phases = knowledgeOrganizeSourcePhases({
      watching: true,
      sourceStatus: 'ready',
      embedJobStatus: 'pending',
      graphJobStatus: 'pending'
    })
    expect(phases.find((phase) => phase.id === 'embed')?.status).toBe('pending')
    expect(phases.find((phase) => phase.id === 'graph')?.status).toBe('pending')
  })

  it('should show the queued graph total from known windows or page count', () => {
    const fromWindows = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'pending',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'pending',
        windowsDone: 0,
        windowsTotal: 8
      }
    }).find((phase) => phase.id === 'graph')
    expect(fromWindows).toEqual({
      id: 'graph',
      status: 'pending',
      completed: 0,
      total: 8
    })
    const fromPages = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'pending',
      pageCount: 12
    }).find((phase) => phase.id === 'graph')
    expect(fromPages).toEqual({
      id: 'graph',
      status: 'pending',
      completed: 0,
      total: 12
    })
  })

  it('should show node embed counts while node vectors are still queued or running', () => {
    const phases = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 8,
        windowsTotal: 8,
        nodesDone: 3,
        nodesTotal: 15
      }
    })
    expect(phases.find((phase) => phase.id === 'graphNodes')).toEqual({
      id: 'graphNodes',
      status: 'running',
      completed: 3,
      total: 15
    })
  })

  it('should not treat leftover embed progress as running when the source is already ready', () => {
    const embed = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      ingestProgress: { page: 1, total: 1, phase: 'embed' }
    }).find((phase) => phase.id === 'embed')
    expect(embed).toEqual({ id: 'embed', status: 'done', completed: 0, total: 0 })
  })

  it('should show graph window or page counts while graph extract is running', () => {
    const graph = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      ingestProgress: { page: 5, total: 20, phase: 'graph' }
    }).find((phase) => phase.id === 'graph')
    expect(graph).toEqual({
      id: 'graph',
      status: 'running',
      completed: 5,
      total: 20
    })
  })

  it('should show graph page span from the job when live ingest progress is missing', () => {
    const graph = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 2,
        windowsTotal: 8,
        pageFrom: 19,
        pageTo: 32,
        pageTotal: 222
      }
    }).find((phase) => phase.id === 'graph')
    expect(graph).toEqual({
      id: 'graph',
      status: 'running',
      completed: 32,
      total: 222,
      pageFrom: 19,
      pageTo: 32,
      pageTotal: 222
    })
  })

  it('should keep leftover embed waiting after restart until the user continues', () => {
    const embed = knowledgeOrganizeSourcePhases({
      watching: false,
      sourceStatus: 'embedding',
      embedJobStatus: 'pending'
    }).find((phase) => phase.id === 'embed')
    expect(embed?.status).toBe('pending')
  })

  it('should show embed chunk counts while embedding is running', () => {
    const embed = knowledgeOrganizeSourcePhases({
      sourceStatus: 'embedding',
      embedJobStatus: 'running',
      ingestProgress: { page: 12, total: 48, phase: 'embed' }
    }).find((phase) => phase.id === 'embed')
    expect(embed).toEqual({
      id: 'embed',
      status: 'running',
      completed: 12,
      total: 48
    })
  })

  it('should keep graph extract running with its total until node counts exist', () => {
    const phases = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      pageCount: 12,
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 1,
        windowsTotal: 1
      }
    })
    expect(phases.find((phase) => phase.id === 'graph')).toEqual({
      id: 'graph',
      status: 'running',
      completed: 1,
      total: 1
    })
    expect(phases.find((phase) => phase.id === 'graphNodes')).toEqual({
      id: 'graphNodes',
      status: 'pending',
      completed: 0,
      total: 0
    })
    const stillExtracting = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      graphJob: {
        sourceId: 'a',
        title: '讲义',
        status: 'running',
        windowsDone: 3,
        windowsTotal: 8,
        nodesDone: 2,
        nodesTotal: 4
      }
    })
    expect(stillExtracting.find((phase) => phase.id === 'graph')?.status).toBe('running')
    expect(stillExtracting.find((phase) => phase.id === 'graphNodes')).toEqual({
      id: 'graphNodes',
      status: 'running',
      completed: 2,
      total: 4
    })
    const fromPages = knowledgeOrganizeSourcePhases({
      sourceStatus: 'ready',
      graphJobStatus: 'running',
      pageCount: 12
    }).find((phase) => phase.id === 'graph')
    expect(fromPages).toEqual({
      id: 'graph',
      status: 'running',
      completed: 0,
      total: 12
    })
  })
})

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
