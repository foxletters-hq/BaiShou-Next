import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const dir = dirname(fileURLToPath(import.meta.url))
const ipc = readFileSync(join(dir, '..', 'rag-query.ipc.ts'), 'utf8')
const counts = readFileSync(
  join(dir, '../../services/pending-embed-counts.service.ts'),
  'utf8'
)

describe('rag delete entry refreshes pending embed counts', () => {
  it('should notify pending embed counts after every delete path', () => {
    expect(ipc).toContain("handle('rag:delete-entry'")
    expect(ipc).toContain('finally')
    expect(ipc).toContain('notifyPendingEmbedCountsChanged')
    expect(ipc).not.toContain('webContents.send')
    expect(counts).toContain('export function notifyPendingEmbedCountsChanged')
    expect(counts).toContain("type: 'embed-pending-changed'")
    expect(counts).toContain('cache.invalidate()')
  })
})
