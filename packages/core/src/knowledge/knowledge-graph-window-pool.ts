import { yieldEventLoop } from './extract-engines/pool.util'

/**
 * 跟桌面端日记抽图一样：有限并发抽窗口，攒满一池再对齐。
 * 池未清空前不再开新窗口，下一批才能搜到这一池写入的节点。
 */
export async function runKnowledgeGraphWindowPool<T, R>(input: {
  items: T[]
  concurrency: number
  alignPoolSize: number
  run: (item: T) => Promise<R | null>
  onResult?: (result: R | null) => Promise<void>
  flush: (batch: R[]) => Promise<void>
}): Promise<R[]> {
  const concurrency = Math.max(1, input.concurrency)
  const alignPoolSize = Math.max(1, input.alignPoolSize)
  const collected: R[] = []
  const pool: R[] = []
  let cursor = 0
  let inFlight = 0
  let chain = Promise.resolve()
  let settled = false
  let rejected = false

  return new Promise((resolve, reject) => {
    const fail = (error: unknown) => {
      if (settled || rejected) return
      rejected = true
      reject(error)
    }

    const enqueue = (task: () => Promise<void>) => {
      const run = chain.then(task, task)
      chain = run.then(
        () => undefined,
        () => undefined
      )
      return run
    }

    const flushNow = async () => {
      if (pool.length === 0) return
      const batch = pool.splice(0, pool.length)
      collected.push(...batch)
      // 对齐/写库让出事件循环，避免和页面点按挤在同一拍。
      await yieldEventLoop()
      await input.flush(batch)
      await yieldEventLoop()
    }

    const step = async () => {
      if (settled || rejected) return
      while (
        inFlight < concurrency &&
        inFlight + pool.length < alignPoolSize &&
        cursor < input.items.length
      ) {
        const item = input.items[cursor]!
        cursor += 1
        inFlight += 1
        void input.run(item).then(
          (result) => {
            void enqueue(() => finish(result)).catch(fail)
          },
          (error) => {
            void enqueue(async () => {
              inFlight -= 1
              throw error
            }).catch(fail)
          }
        )
      }
      if (!rejected && cursor >= input.items.length && inFlight === 0) {
        if (pool.length > 0) await flushNow()
        if (settled || rejected) return
        settled = true
        resolve(collected)
      }
    }

    const finish = async (result: R | null) => {
      if (rejected) return
      inFlight -= 1
      if (result != null) pool.push(result)
      await yieldEventLoop()
      await input.onResult?.(result)
      if (pool.length >= alignPoolSize || (cursor >= input.items.length && inFlight === 0)) {
        await flushNow()
      }
      await step()
    }

    if (input.items.length === 0) {
      settled = true
      resolve([])
      return
    }
    void enqueue(step).catch(fail)
  })
}
