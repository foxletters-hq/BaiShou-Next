import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../rag-build.ipc.ts'), 'utf8')

describe('rag clear-all', () => {
  it('should stop organize and wipe the life graph when life_graph is selected', () => {
    expect(src).toContain("handle('rag:clear-all'")
    const handler = src.slice(src.indexOf("handle('rag:clear-all'"))
    expect(handler).toContain('requestBatchEmbedCancel')
    expect(handler).toContain('extractQueue.stop')
    expect(handler.indexOf('requestBatchEmbedCancel')).toBeLessThan(
      handler.indexOf('clearLifeGraphData')
    )
    expect(handler.indexOf("kinds.includes('life_graph')")).toBeLessThan(
      handler.indexOf('clearLifeGraphData')
    )
  })
})
