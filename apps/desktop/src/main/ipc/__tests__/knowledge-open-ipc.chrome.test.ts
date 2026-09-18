import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ipc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'knowledge.ipc.ts'),
  'utf8'
)

describe('knowledge open ipc', () => {
  it('should not always kick ingest after recover-stale and should filter graph jobs in sql', () => {
    expect(ipc).toContain('shouldKickKnowledgeIngestAfterRecover')
    expect(ipc).toContain("listIngestJobs({ notebookId: id, stage: 'graph' })")
    expect(ipc).not.toContain('(await repo.listIngestJobs()).filter(')
  })
})
