import { describe, expect, it, vi } from 'vitest'
import { GraphExtractQueueEngine, type GraphExtractQueueRunner } from '../graph-extract-queue-engine'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createEngine(runner: GraphExtractQueueRunner) {
  const engine = new GraphExtractQueueEngine({
    watchdogMs: 0,
    cleanupMs: 0,
    deferKick: false,
    concurrency: 1,
    progressThrottleMs: 0
  })
  engine.setRunner(runner)
  return engine
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('GraphExtractQueueEngine', () => {
  it('starts the next pending item after the current one completes', async () => {
    const first = deferred<{ done: number; failed: number; errors: [] }>()
    const second = deferred<{ done: number; failed: number; errors: [] }>()
    let calls = 0
    const engine = createEngine(async ({ filePath }) => {
      calls++
      if (filePath.endsWith('a.md')) return first.promise
      return second.promise
    })

    engine.enqueue([
      { filePath: 'Journal\\a.md', date: '2026-07-07' },
      { filePath: 'Journal/b.md', date: '2026-07-06' }
    ])
    await flush()

    expect(engine.getQueueState().runningCount).toBe(1)
    expect(engine.getQueueState().items.find((i) => i.id.endsWith('a.md'))?.status).toBe('running')
    expect(engine.getQueueState().items.find((i) => i.id.endsWith('b.md'))?.status).toBe('pending')

    first.resolve({ done: 1, failed: 0, errors: [] })
    await flush()

    expect(engine.getQueueState().items.find((i) => i.id.endsWith('a.md'))?.status).toBe('completed')
    expect(engine.getQueueState().items.find((i) => i.id.endsWith('b.md'))?.status).toBe('running')
    expect(calls).toBe(2)

    second.resolve({ done: 1, failed: 0, errors: [] })
    await flush()

    expect(engine.getQueueState().runningCount).toBe(0)
    expect(engine.getQueueState().completedCount).toBe(2)
  })

  it('stop aborts the in-flight stream and drops the queue', async () => {
    const first = deferred<{ done: number; failed: number; errors: [] }>()
    let signal: AbortSignal | undefined
    const persisted: Array<Array<{ filePath: string; date?: string }>> = []
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 0,
      deferKick: false,
      concurrency: 1,
      progressThrottleMs: 0,
      persist: (pending) => persisted.push(pending)
    })
    engine.setRunner(async (opts) => {
      signal = opts.signal
      return first.promise
    })

    engine.enqueue([
      { filePath: 'Journal/a.md', date: '2026-07-07' },
      { filePath: 'Journal/b.md', date: '2026-07-06' }
    ])
    await flush()
    expect(engine.getQueueState().runningCount).toBe(1)

    engine.stop()
    expect(signal?.aborted).toBe(true)
    expect(engine.isRunning).toBe(false)
    expect(engine.getQueueState().items).toEqual([])
    expect(persisted.at(-1)).toEqual([])

    first.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    expect(engine.isRunning).toBe(false)
    expect(engine.getQueueState().items).toEqual([])
  })

  it('allows enqueue after stop without keeping the previous batch', async () => {
    const first = deferred<{ done: number; failed: number; errors: [] }>()
    const second = deferred<{ done: number; failed: number; errors: [] }>()
    let calls = 0
    const engine = createEngine(async ({ filePath, signal }) => {
      calls++
      if (filePath.endsWith('a.md')) {
        await first.promise
        if (signal.aborted) {
          const err = new DOMException('The operation was aborted', 'AbortError')
          throw err
        }
        return { done: 1, failed: 0, errors: [] }
      }
      return second.promise
    })

    engine.enqueue([{ filePath: 'Journal/a.md' }, { filePath: 'Journal/b.md' }])
    await flush()
    expect(calls).toBe(1)

    engine.stop()
    expect(engine.getQueueState().items).toEqual([])

    engine.enqueue([{ filePath: 'Journal/c.md' }])
    await flush()
    expect(calls).toBe(2)
    expect(engine.getQueueState().items.find((i) => i.id.endsWith('c.md'))?.status).toBe('running')

    first.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    expect(engine.getQueueState().items.find((i) => i.id.endsWith('c.md'))?.status).toBe('running')
    expect(engine.getQueueState().items.some((i) => i.id.endsWith('a.md'))).toBe(false)

    second.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    expect(engine.getQueueState().items.find((i) => i.id.endsWith('c.md'))?.status).toBe('completed')
  })

  it('does not let a late aborted runner replace a re-enqueued same path', async () => {
    const first = deferred<{ done: number; failed: number; errors: [] }>()
    const second = deferred<{ done: number; failed: number; errors: [] }>()
    const engine = createEngine(async () => first.promise)
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()

    engine.stop()
    engine.setRunner(async () => second.promise)
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()
    expect(engine.getQueueState().items).toHaveLength(1)
    expect(engine.getQueueState().items[0]?.status).toBe('running')

    first.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    expect(engine.getQueueState().items).toHaveLength(1)
    expect(engine.getQueueState().items[0]?.status).toBe('running')

    second.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    expect(engine.getQueueState().items[0]?.status).toBe('completed')
  })

  it('cancelItem aborts a running job and removes it immediately', async () => {
    const hold = deferred<{ done: number; failed: number; errors: [] }>()
    let signal: AbortSignal | undefined
    const engine = createEngine(async (opts) => {
      signal = opts.signal
      return hold.promise
    })
    engine.enqueue([{ filePath: 'Journal/a.md' }, { filePath: 'Journal/b.md' }])
    await flush()
    expect(engine.cancelItem('Journal/a.md')).toBe(true)
    expect(signal?.aborted).toBe(true)
    expect(engine.getQueueState().items.some((i) => i.id.endsWith('a.md'))).toBe(false)

    hold.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    expect(engine.getQueueState().items.some((i) => i.id.endsWith('a.md'))).toBe(false)
  })

  it('aborts an in-flight align flush on stop', async () => {
    const flushHold = deferred<Array<{ filePath: string }>>()
    let flushSignal: AbortSignal | undefined
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 0,
      deferKick: false,
      concurrency: 1,
      progressThrottleMs: 0,
      alignPoolSize: 1,
      flushDrafts: async (_drafts, signal) => {
        flushSignal = signal
        return flushHold.promise
      }
    })
    engine.setRunner(async ({ filePath }) => ({
      done: 1,
      failed: 0,
      errors: [],
      draft: { filePath }
    }))
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()
    await flush()
    expect(engine.getQueueState().items[0]?.status).toBe('aligning')

    engine.stop()
    expect(flushSignal?.aborted).toBe(true)
    expect(engine.isRunning).toBe(false)
    expect(engine.getQueueState().items).toEqual([])

    flushHold.resolve([{ filePath: 'Journal/a.md' }])
    await flush()
    expect(engine.getQueueState().items).toEqual([])
  })

  it('marks empty extract results as skipped, not completed', async () => {
    const engine = createEngine(async () => ({ done: 0, failed: 0, errors: [] }))
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()

    const item = engine.getQueueState().items[0]
    expect(item?.status).toBe('error')
    expect(item?.error).toContain('跳过')
    expect(engine.getQueueState().completedCount).toBe(0)
  })

  it('does not keep duplicate ids when re-enqueueing a finished path', async () => {
    const engine = createEngine(async () => ({ done: 1, failed: 0, errors: [] }))
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()

    expect(engine.getQueueState().items).toHaveLength(1)
    expect(engine.getQueueState().items[0]?.status).toBe('completed')

    const hold = deferred<{ done: number; failed: number; errors: [] }>()
    engine.setRunner(async () => hold.promise)
    const added = engine.enqueue([{ filePath: 'Journal\\a.md' }])
    expect(added).toBe(1)
    await flush()

    const items = engine.getQueueState().items.filter((i) => i.id.endsWith('a.md'))
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('running')
    hold.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
  })

  it('does not drop completed items while later jobs are still open', async () => {
    const first = deferred<{ done: number; failed: number; errors: [] }>()
    const second = deferred<{ done: number; failed: number; errors: [] }>()
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 20,
      deferKick: false,
      concurrency: 1,
      progressThrottleMs: 0
    })
    engine.setRunner(async ({ filePath }) =>
      filePath.endsWith('a.md') ? first.promise : second.promise
    )
    engine.enqueue([{ filePath: 'Journal/a.md' }, { filePath: 'Journal/b.md' }])
    await flush()
    first.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
    await new Promise((r) => setTimeout(r, 30))
    expect(engine.getQueueState().completedCount).toBe(1)
    expect(engine.getQueueState().items).toHaveLength(2)
    second.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
  })

  it('skips paths already pending or running', () => {
    const hold = deferred<{ done: number; failed: number; errors: [] }>()
    const engine = createEngine(async () => hold.promise)
    expect(engine.enqueue([{ filePath: 'Journal/a.md' }])).toBe(1)
    expect(engine.enqueue([{ filePath: 'Journal\\a.md' }])).toBe(0)
    hold.resolve({ done: 1, failed: 0, errors: [] })
  })

  it('runs up to the configured concurrency', async () => {
    const a = deferred<{ done: number; failed: number; errors: [] }>()
    const b = deferred<{ done: number; failed: number; errors: [] }>()
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 0,
      deferKick: false,
      concurrency: 2,
      progressThrottleMs: 0
    })
    engine.setRunner(async ({ filePath }) => (filePath.endsWith('a.md') ? a.promise : b.promise))
    engine.enqueue([{ filePath: 'Journal/a.md' }, { filePath: 'Journal/b.md' }])
    await flush()
    expect(engine.getQueueState().runningCount).toBe(2)
    a.resolve({ done: 1, failed: 0, errors: [] })
    b.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
  })

  it('holds drafts until the align pool is full, then flushes', async () => {
    const flushed: string[][] = []
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 0,
      deferKick: false,
      concurrency: 2,
      progressThrottleMs: 0,
      alignPoolSize: 2,
      flushDrafts: async (drafts) => {
        flushed.push(drafts.map((d) => d.filePath))
        return drafts.map((d) => ({ filePath: d.filePath }))
      }
    })
    engine.setRunner(async ({ filePath }) => ({
      done: 1,
      failed: 0,
      errors: [],
      draft: { filePath }
    }))
    engine.enqueue([
      { filePath: 'Journal/a.md' },
      { filePath: 'Journal/b.md' },
      { filePath: 'Journal/c.md' }
    ])
    await flush()
    await flush()
    await flush()
    expect(flushed[0]?.sort()).toEqual(['Journal/a.md', 'Journal/b.md'].sort())
    await flush()
    await flush()
    expect(flushed.some((batch) => batch.includes('Journal/c.md'))).toBe(true)
    expect(engine.getQueueState().completedCount).toBe(3)
  })

  it('records model phase from runner progress without char details', async () => {
    const hold = deferred<{ done: number; failed: number; errors: [] }>()
    const engine = createEngine(async ({ onProgress }) => {
      onProgress?.({ phase: 'model', progress: 99, detail: '120' })
      return hold.promise
    })
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()
    const item = engine.getQueueState().items[0]
    expect(item?.phase).toBe('model')
    expect(item?.phaseDetail).toBeUndefined()
    expect(item?.progress).toBe(40)
    hold.resolve({ done: 1, failed: 0, errors: [] })
    await flush()
  })

  it('marks finished drafts as waiting for the align pool', async () => {
    const second = deferred<{ done: number; failed: number; errors: []; draft: { filePath: string } }>()
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 0,
      deferKick: false,
      concurrency: 1,
      progressThrottleMs: 0,
      alignPoolSize: 10,
      flushDrafts: async () => []
    })
    engine.setRunner(async ({ filePath }) => {
      if (filePath.endsWith('b.md')) return second.promise
      return { done: 1, failed: 0, errors: [], draft: { filePath } }
    })
    engine.enqueue([{ filePath: 'Journal/a.md' }, { filePath: 'Journal/b.md' }])
    await flush()
    await flush()
    const waiting = engine.getQueueState().items.find((i) => i.id.endsWith('a.md'))
    expect(waiting?.status).toBe('aligning')
    expect(waiting?.phase).toBe('waiting_pool')
    expect(waiting?.phaseDetail).toBe('1/10')
    expect(engine.getQueueState().alignPoolCount).toBe(1)
    second.resolve({ done: 1, failed: 0, errors: [], draft: { filePath: 'Journal/b.md' } })
    await flush()
  })

  it('moves waiting drafts through recall, align, then writing', async () => {
    const flushHold = deferred<Array<{ filePath: string }>>()
    let onPhase: ((phase: string, detail?: string) => void) | undefined
    const engine = new GraphExtractQueueEngine({
      watchdogMs: 0,
      cleanupMs: 0,
      deferKick: false,
      concurrency: 1,
      progressThrottleMs: 0,
      alignPoolSize: 1,
      flushDrafts: async (_drafts, _signal, reportPhase) => {
        onPhase = reportPhase
        return flushHold.promise
      }
    })
    engine.setRunner(async ({ filePath }) => ({
      done: 1,
      failed: 0,
      errors: [],
      draft: { filePath }
    }))
    engine.enqueue([{ filePath: 'Journal/a.md' }])
    await flush()
    await flush()
    await flush()
    expect(engine.getQueueState().items[0]?.phase).toBe('recalling')
    onPhase?.('waiting_align')
    expect(engine.getQueueState().items[0]?.phase).toBe('waiting_align')
    onPhase?.('writing')
    expect(engine.getQueueState().items[0]?.phase).toBe('writing')
    flushHold.resolve([{ filePath: 'Journal/a.md' }])
    await flush()
    expect(engine.getQueueState().items[0]?.status).toBe('completed')
  })

  it('keeps model-stage progress fixed while waiting', async () => {
    vi.useFakeTimers()
    try {
      const first = deferred<{ done: number; failed: number; errors: [] }>()
      const engine = createEngine(async ({ onProgress }) => {
        onProgress?.({ phase: 'model', progress: 14 })
        onProgress?.({ phase: 'model', progress: 40 })
        onProgress?.({ progress: 55 })
        return first.promise
      })
      engine.enqueue([{ filePath: 'Journal/a.md' }])
      await flush()
      const item = engine.getQueueState().items[0]
      expect(item?.phase).toBe('model')
      expect(item?.progress).toBe(40)
      await vi.advanceTimersByTimeAsync(8000)
      expect(engine.getQueueState().items[0]?.phase).toBe('model')
      expect(engine.getQueueState().items[0]?.progress).toBe(40)
      first.resolve({ done: 1, failed: 0, errors: [] })
      await flush()
    } finally {
      vi.useRealTimers()
    }
  })
})
