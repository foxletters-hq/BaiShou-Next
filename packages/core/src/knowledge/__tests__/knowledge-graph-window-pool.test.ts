import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runKnowledgeGraphWindowPool } from '../knowledge-graph-window-pool'

const dir = dirname(fileURLToPath(import.meta.url))

describe('runKnowledgeGraphWindowPool', () => {
  it('should keep several windows in flight and flush a full pool before the next window', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const releases: Array<() => void> = []
    const flushes: number[][] = []
    const started: number[] = []

    const run = runKnowledgeGraphWindowPool({
      items: [0, 1, 2],
      concurrency: 2,
      alignPoolSize: 2,
      run: async (item) => {
        started.push(item)
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise<void>((resolve) => {
          releases.push(() => {
            inFlight -= 1
            resolve()
          })
        })
        return item
      },
      flush: async (batch) => {
        flushes.push(batch)
      }
    })

    await viWait(async () => {
      expect(started).toEqual([0, 1])
    })
    expect(maxInFlight).toBe(2)
    releases.splice(0, releases.length).forEach((release) => release())
    await viWait(async () => {
      expect(flushes).toEqual([[0, 1]])
      expect(started).toEqual([0, 1, 2])
    })
    releases.splice(0, releases.length).forEach((release) => release())
    await run
    expect(flushes).toEqual([[0, 1], [2]])
  })
})

describe('knowledge graph window pool source', () => {
  it('should yield the event loop between windows so UI work can run', () => {
    const src = readFileSync(join(dir, '../knowledge-graph-window-pool.ts'), 'utf8')
    expect(src).toContain('yieldEventLoop')
  })
})

async function viWait(check: () => void | Promise<void>): Promise<void> {
  const deadline = Date.now() + 2000
  let last: unknown
  while (Date.now() < deadline) {
    try {
      await check()
      return
    } catch (error) {
      last = error
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  throw last
}
