/**
 * 按 key 串行化异步任务：同一影子仓库的 git 操作必须排队，
 * 否则并发写 index 会撞上 index.lock；不同仓库之间互不阻塞。
 */
export interface KeyedMutex {
  run<T>(key: string, task: () => Promise<T>): Promise<T>
}

export function createKeyedMutex(): KeyedMutex {
  const tails = new Map<string, Promise<unknown>>()

  return {
    run<T>(key: string, task: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve()
      const result = previous.then(task, task)
      const tail = result.then(
        () => undefined,
        () => undefined
      )
      tails.set(key, tail)
      void tail.then(() => {
        if (tails.get(key) === tail) tails.delete(key)
      })
      return result
    }
  }
}
