import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const ipc = readFileSync(join(dir, '..', 'knowledge-notebook.ipc.ts'), 'utf8')
const preload = readFileSync(
  join(dir, '..', '..', '..', 'preload', 'knowledge.api.ts'),
  'utf8'
)

describe('knowledge notebook ipc chrome', () => {
  it('should expose delete-notebook through ingest and preload', () => {
    expect(ipc).toContain("handleKnowledgeIpc('knowledge:delete-notebook'")
    expect(ipc).toContain('svc.deleteNotebook')
    expect(preload).toContain('deleteNotebook:')
    expect(preload).toContain("'knowledge:delete-notebook'")
  })
})
