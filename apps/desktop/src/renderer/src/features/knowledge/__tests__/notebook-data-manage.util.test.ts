import { describe, expect, it } from 'vitest'
import {
  canConfirmNotebookDataManage,
  listNotebookDataManageSteps,
  notebookDataManageHasTarget,
  notebookDataManageFeedback,
  notebookDataManageStatusKind,
  notebookDataManageWatch,
  parseNotebookDataManageResult
} from '../notebook-data-manage.util'

describe('notebook data manage', () => {
  it('should require at least one target when confirming', () => {
    expect(notebookDataManageHasTarget({ vector: false, graph: false })).toBe(false)
    expect(
      canConfirmNotebookDataManage({
        action: 'reprocess',
        vector: false,
        graph: false,
        phrase: '确认清除',
        typed: ''
      })
    ).toBe(false)
  })

  it('should require the confirm phrase only when clearing', () => {
    expect(
      canConfirmNotebookDataManage({
        action: 'clear',
        vector: true,
        graph: false,
        phrase: '确认清除',
        typed: '确认清除'
      })
    ).toBe(true)
    expect(
      canConfirmNotebookDataManage({
        action: 'clear',
        vector: true,
        graph: false,
        phrase: '确认清除',
        typed: '清除'
      })
    ).toBe(false)
    expect(
      canConfirmNotebookDataManage({
        action: 'reprocess',
        vector: false,
        graph: true,
        phrase: '确认清除',
        typed: ''
      })
    ).toBe(true)
  })

  it('should list clear or reprocess steps for the selected targets', () => {
    expect(listNotebookDataManageSteps({ action: 'clear', vector: true, graph: true })).toEqual([
      'clear-vector',
      'clear-graph'
    ])
    expect(
      listNotebookDataManageSteps({ action: 'reprocess', vector: true, graph: false })
    ).toEqual(['reprocess-vector'])
  })

  it('should treat a notebook with no sources as empty reprocess', () => {
    expect(
      notebookDataManageStatusKind({
        action: 'reprocess',
        vector: true,
        graph: true,
        sourceCount: 0,
        vectorQueued: 0,
        graphQueued: 0
      })
    ).toBe('reprocess-empty')
    expect(
      notebookDataManageWatch({
        action: 'reprocess',
        vector: true,
        graph: true,
        sourceCount: 0,
        vectorQueued: 0,
        graphQueued: 0
      })
    ).toEqual({ watch: false, vectorQueued: 0, graphQueued: 0 })
  })

  it('should watch progress only when reprocess queued jobs', () => {
    const queued = {
      action: 'reprocess' as const,
      vector: true,
      graph: true,
      sourceCount: 3,
      vectorQueued: 2,
      graphQueued: 1
    }
    expect(notebookDataManageStatusKind(queued)).toBe('reprocess-queued')
    expect(notebookDataManageWatch(queued)).toEqual({
      watch: true,
      vectorQueued: 2,
      graphQueued: 1
    })
    expect(
      notebookDataManageStatusKind({
        action: 'reprocess',
        vector: true,
        graph: true,
        sourceCount: 2,
        vectorQueued: 0,
        graphQueued: 0
      })
    ).toBe('reprocess-none')
  })

  it('should send no-data reprocess results to toast instead of the page banner', () => {
    expect(notebookDataManageFeedback('reprocess-empty')).toBe('toast')
    expect(notebookDataManageFeedback('reprocess-none')).toBe('toast')
    expect(notebookDataManageFeedback('reprocess-queued')).toBe('banner')
    expect(notebookDataManageFeedback('cleared')).toBe('banner')
  })

  it('should ignore a manage-data payload that has no queue counts', () => {
    expect(parseNotebookDataManageResult({ ok: true })).toBeNull()
    expect(
      parseNotebookDataManageResult({
        action: 'reprocess',
        vector: true,
        graph: false,
        sourceCount: 1,
        vectorQueued: 1,
        graphQueued: 0
      })
    ).toEqual({
      action: 'reprocess',
      vector: true,
      graph: false,
      sourceCount: 1,
      vectorQueued: 1,
      graphQueued: 0
    })
  })
})
