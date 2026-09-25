import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'vault.ipc.ts'), 'utf8')

describe('vault ipc cold start', () => {
  it('should not consume leftover knowledge ingest jobs on vault init', () => {
    expect(src).toContain('export async function initVaultSystem')
    expect(src).not.toContain('scheduleConsumeKnowledgeIngestJobs')
    expect(src).not.toContain('knowledge-ingest-jobs.consumer')
  })
})
