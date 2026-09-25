import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const ipc = readFileSync(join(dir, '..', 'rag-query.ipc.ts'), 'utf8')

function queryEntriesHandler(): string {
  const start = ipc.indexOf("'rag:query-entries'")
  const end = ipc.indexOf("'rag:delete-entry'")
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return ipc.slice(start, end)
}

describe('rag query entries list path', () => {
  it('should load embedding config only for semantic search', () => {
    const handler = queryEntriesHandler()
    const semanticAt = handler.indexOf("params.mode === 'semantic'")
    expect(semanticAt).toBeGreaterThan(-1)
    expect(handler.slice(0, semanticAt)).not.toContain('await config.load()')
    expect(handler.slice(semanticAt)).toContain('await config.load()')
  })

  it('should run memory list, memory count and graph queries together on the text path', () => {
    const handler = queryEntriesHandler()
    const textAt = handler.indexOf('传统文本检索')
    expect(textAt).toBeGreaterThan(-1)
    const textPath = handler.slice(textAt)
    expect(textPath).toContain('Promise.all([')
    expect(textPath).toContain('memoryListQuery')
    expect(textPath).toContain('memoryCountQuery')
    expect(textPath).toContain('listEmbeddedLiveNodesPage')
    expect(textPath).toContain('countEmbeddedLiveNodes')
  })

  it('should not fall through to text search when semantic mode is requested', () => {
    const handler = queryEntriesHandler()
    expect(handler).not.toContain('falling back to text search')
    const semanticAt = handler.indexOf("params.mode === 'semantic'")
    const textAt = handler.indexOf('传统文本检索')
    expect(semanticAt).toBeGreaterThan(-1)
    expect(textAt).toBeGreaterThan(semanticAt)
    const semanticBlock = handler.slice(semanticAt, textAt)
    expect(semanticBlock).toContain('toSerializableAiError')
    expect(semanticBlock).toContain('throw')
    expect(semanticBlock).not.toContain('entries: []')
  })
})
