export type IdleTaskHandle = {
  cancel: () => void
}

export type ScheduleIdleOptions = {
  timeout?: number
}

type IdleDeadline = {
  didTimeout: boolean
  timeRemaining: () => number
}

type RequestIdleCallback = (
  callback: (deadline: IdleDeadline) => void,
  options?: { timeout?: number }
) => number

type CancelIdleCallback = (handle: number) => void

function getIdleScheduler(): {
  requestIdleCallback?: RequestIdleCallback
  cancelIdleCallback?: CancelIdleCallback
} {
  const globalObject = globalThis as typeof globalThis & {
    requestIdleCallback?: RequestIdleCallback
    cancelIdleCallback?: CancelIdleCallback
  }
  return {
    requestIdleCallback: globalObject.requestIdleCallback,
    cancelIdleCallback: globalObject.cancelIdleCallback
  }
}

/** 等主线程空闲后再执行，避免把长任务挤进当前交互帧 */
export function runAfterIdle(task: () => void, options?: ScheduleIdleOptions): IdleTaskHandle {
  let cancelled = false
  const run = (): void => {
    if (cancelled) return
    task()
  }
  const { requestIdleCallback, cancelIdleCallback } = getIdleScheduler()
  if (typeof requestIdleCallback === 'function') {
    const idleOptions = options?.timeout === undefined ? undefined : { timeout: options.timeout }
    const id = idleOptions
      ? requestIdleCallback(() => {
          run()
        }, idleOptions)
      : requestIdleCallback(() => {
          run()
        })
    return {
      cancel: () => {
        cancelled = true
        cancelIdleCallback?.(id)
      }
    }
  }
  const timer = setTimeout(run, 0)
  return {
    cancel: () => {
      cancelled = true
      clearTimeout(timer)
    }
  }
}

export function waitForIdle(options?: ScheduleIdleOptions): Promise<void> {
  return new Promise((resolve) => {
    runAfterIdle(() => resolve(), options)
  })
}
