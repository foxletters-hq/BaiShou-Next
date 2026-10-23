import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'graph-extract-queue.service.ts'),
  'utf8'
)

describe('desktop graph extract queue startup behavior', () => {
  it('should not re-queue unfinished items after an app restart', () => {
    expect(src).not.toContain('restoreFromDisk')
    expect(src).not.toContain('this.enqueue(items)')
    expect(src).toContain('discardPersistedQueue')
  })

  it('should discard the persisted queue when the runner is installed', () => {
    const setRunner = src.slice(src.indexOf('setRunner('), src.indexOf('setFlushDrafts('))
    expect(setRunner).toContain('this.engine.setRunner(runner)')
    expect(setRunner).toContain('this.discardPersistedQueue()')
  })
})
