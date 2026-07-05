/** 全局嵌入槽位上限：限制 API 调用 + SQLite 写入的总在途数，避免批量并发把主进程打满。 */
const EMBED_MAX_IN_FLIGHT = 6

let inFlight = 0
const waitQueue: Array<() => void> = []

function releaseSlot(): void {
  inFlight = Math.max(0, inFlight - 1)
  const next = waitQueue.shift()
  if (next) next()
}

async function acquireSlot(): Promise<void> {
  if (inFlight < EMBED_MAX_IN_FLIGHT) {
    inFlight++
    return
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(() => {
      inFlight++
      resolve()
    })
  })
}

export async function withEmbeddingSlot<T>(action: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await action()
  } finally {
    releaseSlot()
  }
}
