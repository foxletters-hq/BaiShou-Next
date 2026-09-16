import { describe, expect, it } from 'vitest'
import { notebookJobProgressCopy } from '../notebook-job-progress.util'

describe('notebookJobProgressCopy', () => {
  it('should hide when neither vector nor graph work is active', () => {
    expect(
      notebookJobProgressCopy({
        vectorActive: 0,
        graph: {
          pending: 0,
          running: 0,
          failed: 0,
          currentSourceTitle: null
        }
      }).visible
    ).toBe(false)
  })

  it('should describe vector work without mixing in graph jobs', () => {
    const view = notebookJobProgressCopy({
      vectorActive: 1,
      vectorKnownTotal: 1,
      graph: {
        pending: 1,
        running: 1,
        failed: 0,
        currentSourceTitle: '年度报告',
        knownTotal: 1
      }
    })
    expect(view.visible).toBe(true)
    expect(view.vector).toEqual({
      detailKey: 'knowledge.job_vector_active',
      detailParams: { count: 1 },
      percent: 0
    })
    expect(view.graph?.visible).toBe(true)
    expect(view.graph?.detailKey).toBe('knowledge.graph_progress_done_of')
  })

  it('should show vector completion against the known total', () => {
    const view = notebookJobProgressCopy({
      vectorActive: 1,
      vectorKnownTotal: 3,
      graph: {
        pending: 0,
        running: 0,
        failed: 0,
        currentSourceTitle: null
      }
    })
    expect(view.graph).toBeNull()
    expect(view.vector).toEqual({
      detailKey: 'knowledge.job_vector_done_of',
      detailParams: { done: 2, total: 3 },
      percent: 67
    })
  })
})
