import { describe, expect, it } from 'vitest'
import {
  formatNotebookGraphProgress,
  notebookGraphProgressCopy
} from '../notebook-graph-progress.util'

describe('notebookGraphProgressCopy', () => {
  it('shows when only running remains', () => {
    expect(
      notebookGraphProgressCopy({
        pending: 0,
        running: 1,
        failed: 0,
        currentSourceTitle: '年度报告'
      }).visible
    ).toBe(true)
  })

  it('uses window progress when a source is mid-extract', () => {
    const view = notebookGraphProgressCopy({
      pending: 1,
      running: 1,
      failed: 0,
      currentSourceTitle: '年度报告',
      knownTotal: 1,
      windowsDone: 2,
      windowsTotal: 5
    })
    expect(view.percent).toBe(40)
    expect(view.detailKey).toBe('knowledge.graph_progress_window')
    expect(view.detailParams).toEqual({ done: 2, total: 5 })
  })

  it('hides when the queue is empty', () => {
    expect(
      notebookGraphProgressCopy({
        pending: 0,
        running: 0,
        failed: 0,
        currentSourceTitle: null
      }).visible
    ).toBe(false)
  })

  it('shows current source and remaining count', () => {
    const view = notebookGraphProgressCopy({
      pending: 2,
      running: 1,
      failed: 0,
      currentSourceTitle: '年度报告',
      knownTotal: 5
    })
    expect(view.visible).toBe(true)
    expect(view.percent).toBe(60)
    expect(view.headlineKey).toBe('knowledge.graph_progress_current')
    expect(view.headlineParams).toEqual({ title: '年度报告' })
    expect(view.detailKey).toBe('knowledge.graph_progress_done_of')
    expect(view.detailParams).toEqual({ done: 3, total: 5 })
  })

  it('formats copy through i18n', () => {
    const copy = notebookGraphProgressCopy({
      pending: 2,
      running: 1,
      failed: 0,
      currentSourceTitle: '年度报告',
      knownTotal: 5
    })
    const formatted = formatNotebookGraphProgress(copy, (key, params) => {
      if (key === 'knowledge.graph_progress_current') return `Extracting “${params?.title}”`
      if (key === 'knowledge.graph_progress_done_of') {
        return `Finished ${params?.done} / ${params?.total}`
      }
      return key
    })
    expect(formatted.headline).toBe('Extracting “年度报告”')
    expect(formatted.detail).toBe('Finished 3 / 5')
  })
})
