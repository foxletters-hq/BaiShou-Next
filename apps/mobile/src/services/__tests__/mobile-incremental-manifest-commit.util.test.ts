import { describe, expect, it } from 'vitest'
import { IncrementalManifestCommitQueue } from '../mobile-incremental-manifest-commit.util'

describe('IncrementalManifestCommitQueue', () => {
  it('runs manifest commits sequentially', async () => {
    const queue = new IncrementalManifestCommitQueue()
    const order: number[] = []

    const first = queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
      order.push(1)
    })
    const second = queue.run(async () => {
      order.push(2)
    })

    await Promise.all([first, second])
    expect(order).toEqual([1, 2])
  })
})
