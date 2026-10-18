import { describe, expect, it } from 'vitest'
import {
  knowledgeOrganizeHasLiveWork,
  notebookOrganizeHasActiveJobs,
  notebookOrganizeShouldKeepWatching,
  resolveNotebookOrganizeFabState
} from '../knowledge-organize-fab.util'

describe('resolveNotebookOrganizeFabState', () => {
  it('should stay pending when leftover jobs are only queued and the user has not started', () => {
    expect(
      resolveNotebookOrganizeFabState({
        sourcesReady: true,
        ingestingCount: 0,
        sources: [{ id: 'a', status: 'stored' }],
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toEqual({ kind: 'pending', pendingCount: 1 })
  })

  it('should show running after the user starts organize while jobs are still queued', () => {
    expect(
      resolveNotebookOrganizeFabState({
        sourcesReady: true,
        watching: true,
        ingestingCount: 0,
        sources: [{ id: 'a', status: 'stored' }],
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toEqual({ kind: 'running', pendingCount: 1 })
  })

  it('should treat queued jobs as still active until they finish or fail', () => {
    expect(
      notebookOrganizeHasActiveJobs({
        ingestingCount: 0,
        sources: [{ status: 'stored' }],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe(true)
    expect(
      notebookOrganizeHasActiveJobs({
        ingestingCount: 0,
        sources: [{ status: 'stored' }],
        ingestJobItems: [{ status: 'failed' }],
        ocrProgressBySource: {}
      })
    ).toBe(false)
  })

  it('should keep watching when queued sources remain after jobs drop out of the list', () => {
    expect(
      notebookOrganizeShouldKeepWatching({
        ingestingCount: 0,
        sources: [{ status: 'stored' }],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toBe(true)
  })

  it('should stop watching when sources failed and no jobs are running', () => {
    expect(
      notebookOrganizeShouldKeepWatching({
        ingestingCount: 0,
        sources: [{ status: 'failed' }],
        ingestJobItems: [{ status: 'failed' }],
        ocrProgressBySource: {}
      })
    ).toBe(false)
  })

  it('should stay pending after restart when leftover source is still embedding', () => {
    expect(
      knowledgeOrganizeHasLiveWork({
        ingestingCount: 1,
        sources: [{ id: 'a', status: 'embedding' }],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toBe(false)
    expect(
      resolveNotebookOrganizeFabState({
        sourcesReady: true,
        ingestingCount: 1,
        sources: [{ id: 'a', status: 'embedding' }],
        graphJobItems: [],
        ingestJobItems: [{ status: 'pending' }],
        ocrProgressBySource: {}
      })
    ).toEqual({ kind: 'pending', pendingCount: 1 })
  })

  it('should not treat leftover embed progress on a ready source as live work', () => {
    expect(
      knowledgeOrganizeHasLiveWork({
        ingestingCount: 0,
        sources: [{ id: 'a', status: 'ready' }],
        ingestJobItems: [],
        ocrProgressBySource: { a: { page: 1, total: 1, phase: 'embed' } }
      })
    ).toBe(false)
    expect(
      notebookOrganizeShouldKeepWatching({
        ingestingCount: 0,
        sources: [{ id: 'a', status: 'ready' }],
        ingestJobItems: [],
        ocrProgressBySource: { a: { page: 1, total: 1, phase: 'embed' } }
      })
    ).toBe(false)
  })

  it('should not keep running when watching but nothing is left to organize', () => {
    expect(
      resolveNotebookOrganizeFabState({
        sourcesReady: true,
        watching: true,
        ingestingCount: 0,
        sources: [{ id: 'a', status: 'ready' }],
        graphJobItems: [],
        ingestJobItems: [],
        ocrProgressBySource: {}
      })
    ).toEqual({ kind: 'idle', pendingCount: 0 })
  })
})
