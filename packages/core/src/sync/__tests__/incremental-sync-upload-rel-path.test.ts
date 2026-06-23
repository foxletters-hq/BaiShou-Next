import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { InMemoryIncrementalCloudClient, SharedCloudStore } from './helpers/shared-cloud-store'

describe('incremental sync upload uses explicit manifest relPath', () => {
  let syncRoot: string
  let store: SharedCloudStore
  let client: InMemoryIncrementalCloudClient

  beforeEach(async () => {
    syncRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'incr-upload-rel-'))
    store = new SharedCloudStore()
    client = new InMemoryIncrementalCloudClient(store)
    client.setSyncRoot(syncRoot)
  })

  afterEach(async () => {
    await fs.rm(syncRoot, { recursive: true, force: true }).catch(() => null)
  })

  it('uploads external journal file under virtual Personal/Journals key', async () => {
    const externalJournals = path.join(syncRoot, 'outside-vault', 'journals')
    await fs.mkdir(path.join(externalJournals, '2024', '06'), { recursive: true })
    const localFile = path.join(externalJournals, '2024', '06', '2024-06-01.md')
    await fs.writeFile(localFile, '# diary', 'utf8')

    const virtualRel = 'Personal/Journals/2024/06/2024-06-01.md'
    await client.uploadFile(localFile, virtualRel)

    expect(store.has(virtualRel)).toBe(true)
    expect(store.has('outside-vault/journals/2024/06/2024-06-01.md')).toBe(false)
    expect(store.has('2024-06-01.md')).toBe(false)
  })
})
