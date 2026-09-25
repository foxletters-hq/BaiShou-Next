import { describe, expect, it } from 'vitest'
import {
  knowledgeOrganizeCompactKind,
  notebookOrganizeProgressCopy
} from '../notebook-job-progress.util'

const idleGraph = {
  pending: 0,
  running: 0,
  failed: 0,
  currentSourceTitle: null
}

describe('notebookOrganizeProgressCopy', () => {
  it('should hide when no source is actually being organized', () => {
    expect(
      notebookOrganizeProgressCopy({
        sources: [
          { id: 'a', title: '扫描失败', status: 'failed' },
          { id: 'b', title: '深度关系', status: 'stored' }
        ],
        graph: idleGraph
      }).visible
    ).toBe(false)
  })

  it('should keep a single embed in a one-item session even if the notebook has two sources', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [
        { id: 'a', title: '扫描失败', status: 'failed' },
        { id: 'b', title: '深度关系', status: 'embedding' }
      ],
      ingestProgress: {
        b: { page: 12, total: 80, phase: 'embed' }
      },
      graph: idleGraph
    })

    expect(view.visible).toBe(true)
    expect(view.currentTitle).toBe('深度关系')
    expect(view.items.map((row) => row.sourceId)).toEqual(['b'])
    expect(view.phases.find((row) => row.id === 'embed')).toEqual(
      expect.objectContaining({
        status: 'running',
        completed: 12,
        total: 80
      })
    )
    expect(view.phases.find((row) => row.id === 'extract')?.status).toBe('done')
  })

  it('should not count a leftover pending source that the user did not queue', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [
        { id: 'stale', title: '卡住的扫描', status: 'pending' },
        { id: 'live', title: '深度关系', status: 'embedding' }
      ],
      queuedSourceIds: ['live'],
      graph: idleGraph
    })

    expect(view.items.map((row) => row.sourceId)).toEqual(['live'])
    expect(view.currentTitle).toBe('深度关系')
  })

  it('should show extract page progress for the current source', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'pdf', title: '合同', status: 'extracting' }],
      ingestProgress: {
        pdf: { page: 3, total: 10, phase: 'vision' }
      },
      graph: idleGraph
    })

    expect(view.phases.find((row) => row.id === 'extract')).toEqual(
      expect.objectContaining({
        status: 'running',
        completed: 3,
        total: 10
      })
    )
    expect(view.phases.find((row) => row.id === 'embed')?.status).toBe('pending')
  })

  it('should show pdf parse progress from the worker without a known total', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'pdf', title: '扫描件', status: 'extracting' }],
      ingestProgress: {
        pdf: { page: 12, total: 0, phase: 'parse' }
      },
      graph: idleGraph
    })

    expect(view.phases.find((row) => row.id === 'extract')).toEqual(
      expect.objectContaining({
        status: 'running',
        completed: 12,
        total: 0
      })
    )
    expect(view.items[0]).toEqual(
      expect.objectContaining({
        activity: 'parse',
        completed: 12,
        total: 0
      })
    )
  })

  it('should list each organizing source with its own phases', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [
        { id: 'pdf', title: '被讨厌的勇气', status: 'ready' },
        { id: 'epub', title: '深度关系', status: 'ready' }
      ],
      graph: {
        pending: 2,
        running: 1,
        failed: 0,
        currentSourceTitle: '被讨厌的勇气'
      },
      graphJobsBySource: {
        pdf: {
          status: 'running',
          windowsDone: 2,
          windowsTotal: 20,
          pageFrom: 19,
          pageTo: 32,
          pageTotal: 222
        },
        epub: { status: 'pending' }
      }
    })
    expect(view.sourceRows.map((row) => row.sourceId)).toEqual(['pdf', 'epub'])
    expect(view.sourceRows[0]?.phases.find((phase) => phase.id === 'graph')?.pageTo).toBe(32)
    expect(view.sourceRows[1]?.phases.find((phase) => phase.id === 'graph')?.status).toBe('pending')
  })

  it('should name the compact banner after the running phase', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'b', title: '深度关系', status: 'ready' }],
      graph: {
        pending: 1,
        running: 1,
        failed: 0,
        currentSourceTitle: '深度关系',
        windowsDone: 2,
        windowsTotal: 6
      }
    })
    expect(knowledgeOrganizeCompactKind(view.phases, view.failed)).toBe('graph')
  })

  it('should show graph window progress after embed', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'b', title: '深度关系', status: 'ready' }],
      graph: {
        pending: 1,
        running: 1,
        failed: 0,
        currentSourceTitle: '深度关系',
        windowsDone: 2,
        windowsTotal: 6
      }
    })

    expect(view.visible).toBe(true)
    expect(view.currentTitle).toBe('深度关系')
    expect(view.phases.find((row) => row.id === 'graph')).toEqual(
      expect.objectContaining({
        status: 'running',
        completed: 2,
        total: 6
      })
    )
  })

  it('should show the pages covered by the current window', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'b', title: '深度关系', status: 'ready' }],
      graph: {
        pending: 1,
        running: 1,
        failed: 0,
        currentSourceTitle: '深度关系',
        windowsDone: 2,
        windowsTotal: 20,
        pageFrom: 12,
        pageTo: 15,
        pageTotal: 186
      }
    })

    expect(view.phases.find((row) => row.id === 'graph')).toEqual(
      expect.objectContaining({
        status: 'running',
        completed: 15,
        total: 186,
        pageFrom: 12,
        pageTo: 15,
        pageTotal: 186
      })
    )
  })

  it('should mark graph failed with the job error instead of a running placeholder', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'b', title: '深度关系', status: 'ready' }],
      graph: {
        pending: 0,
        running: 0,
        failed: 1,
        currentSourceTitle: null,
        failedSourceTitle: '深度关系',
        lastError: 'graph-extract-not-configured'
      }
    })

    expect(view.visible).toBe(true)
    expect(view.failed).toBe(true)
    expect(view.currentTitle).toBe('深度关系')
    expect(view.error).toBe('graph-extract-not-configured')
    expect(view.phases.find((row) => row.id === 'graph')).toEqual(
      expect.objectContaining({
        status: 'failed',
        error: 'graph-extract-not-configured'
      })
    )
    expect(view.phases.find((row) => row.id === 'graphNodes')?.status).toBe('pending')
  })

  it('should mark node vectors failed when the graph job died during embed', () => {
    const view = notebookOrganizeProgressCopy({
      sources: [{ id: 'b', title: '深度关系', status: 'ready' }],
      graph: {
        pending: 0,
        running: 0,
        failed: 1,
        currentSourceTitle: null,
        failedSourceTitle: '深度关系',
        lastError: 'graph-step:node-embed:Payment Required'
      }
    })

    expect(view.failed).toBe(true)
    expect(view.phases.find((row) => row.id === 'graph')?.status).toBe('done')
    expect(view.phases.find((row) => row.id === 'graphNodes')).toEqual(
      expect.objectContaining({
        status: 'failed',
        error: 'graph-step:node-embed:Payment Required'
      })
    )
  })
})
