import { describe, expect, it } from 'vitest'
import {
  clearGraphWindowProgress,
  readGraphWindowProgress,
  rememberGraphWindowProgress,
  resolveListedGraphJobStatus,
  resolveListedGraphWindowProgress,
  shouldResumeListedGraphJobs
} from '../graph-window-progress'

describe('graph window progress', () => {
  it('should replace the remembered count when the same source reports again', () => {
    rememberGraphWindowProgress({
      notebookId: 'nb-remember',
      sourceId: 'src-remember',
      windowsDone: 1,
      windowsTotal: 20
    })
    rememberGraphWindowProgress({
      notebookId: 'nb-remember',
      sourceId: 'src-remember',
      windowsDone: 8,
      windowsTotal: 20
    })

    expect(readGraphWindowProgress('nb-remember', 'src-remember')).toEqual({
      windowsDone: 8,
      windowsTotal: 20
    })
    clearGraphWindowProgress('nb-remember', 'src-remember')
  })

  it('should keep sources separate when remembering window progress', () => {
    rememberGraphWindowProgress({
      notebookId: 'nb-a',
      sourceId: 'src-a',
      windowsDone: 4,
      windowsTotal: 20
    })
    rememberGraphWindowProgress({
      notebookId: 'nb-a',
      sourceId: 'src-b',
      windowsDone: 1,
      windowsTotal: 3
    })

    expect(readGraphWindowProgress('nb-a', 'src-a')?.windowsDone).toBe(4)
    expect(readGraphWindowProgress('nb-a', 'src-b')?.windowsDone).toBe(1)
    clearGraphWindowProgress('nb-a', 'src-a')
    clearGraphWindowProgress('nb-a', 'src-b')
  })

  it('should return the live window when it is ahead of the checkpoint while the job is running', () => {
    expect(
      resolveListedGraphWindowProgress({
        running: true,
        checkpoint: { windowsDone: 1, windowsTotal: 20 },
        live: { windowsDone: 8, windowsTotal: 20 }
      })
    ).toEqual({ windowsDone: 8, windowsTotal: 20 })
  })

  it('should keep the live page range when the job is still running', () => {
    expect(
      resolveListedGraphWindowProgress({
        running: true,
        checkpoint: { windowsDone: 1, windowsTotal: 20 },
        live: {
          windowsDone: 2,
          windowsTotal: 20,
          pageFrom: 12,
          pageTo: 15,
          pageTotal: 186
        }
      })
    ).toEqual({
      windowsDone: 2,
      windowsTotal: 20,
      pageFrom: 12,
      pageTo: 15,
      pageTotal: 186
    })
  })

  it('should ignore live progress when the job is not running', () => {
    expect(
      resolveListedGraphWindowProgress({
        running: false,
        checkpoint: { windowsDone: 1, windowsTotal: 20 },
        live: { windowsDone: 8, windowsTotal: 20 }
      })
    ).toEqual({ windowsDone: 1, windowsTotal: 20 })
  })

  it('should keep the checkpoint when the job is running but no live progress was reported', () => {
    expect(
      resolveListedGraphWindowProgress({
        running: true,
        checkpoint: { windowsDone: 5, windowsTotal: 20 },
        live: null
      })
    ).toEqual({ windowsDone: 5, windowsTotal: 20 })
  })

  it('should return null when neither checkpoint nor live progress has a total', () => {
    expect(
      resolveListedGraphWindowProgress({
        running: true,
        checkpoint: null,
        live: null
      })
    ).toBeNull()
  })
})

describe('listed graph job status', () => {
  it('should treat a database running job as pending when this process is not working it', () => {
    expect(resolveListedGraphJobStatus('running', false)).toBe('pending')
    expect(resolveListedGraphJobStatus('pending', false)).toBe('pending')
    expect(resolveListedGraphJobStatus('failed', false)).toBe('failed')
    expect(resolveListedGraphJobStatus('running', true)).toBe('running')
    expect(resolveListedGraphJobStatus('pending', true)).toBe('running')
  })

  it('should resume leftover pending or failed graph jobs, not a live running one', () => {
    expect(shouldResumeListedGraphJobs([{ status: 'running' }])).toBe(false)
    expect(shouldResumeListedGraphJobs([{ status: 'pending' }])).toBe(true)
    expect(shouldResumeListedGraphJobs([{ status: 'failed' }])).toBe(true)
    expect(
      shouldResumeListedGraphJobs([{ status: 'running' }, { status: 'pending' }])
    ).toBe(true)
  })
})
