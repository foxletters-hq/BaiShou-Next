/** 串行化 manifest 合并与 checkpoint，避免并发 worker 覆盖彼此的变更 */
export class IncrementalManifestCommitQueue {
  private chain: Promise<void> = Promise.resolve()

  run<T>(fn: () => Promise<T>): Promise<T> {
    let result!: T
    const task = this.chain.then(async () => {
      result = await fn()
    })
    this.chain = task.then(
      () => undefined,
      () => undefined
    )
    return task.then(() => result)
  }
}
