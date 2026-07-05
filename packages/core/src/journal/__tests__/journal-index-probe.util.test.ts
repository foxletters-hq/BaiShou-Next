import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import { probeJournalShadowResyncNeeded } from '../journal-index-probe.util'

describe('probeJournalShadowResyncNeeded', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'journal-probe-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('returns needsResync when disk has more journals than shadow index', async () => {
    const journalsDir = path.join(tempDir, 'Journals', '2024', '06')
    await fs.mkdir(journalsDir, { recursive: true })
    await fs.writeFile(path.join(journalsDir, '2024-06-01.md'), '# one')
    await fs.writeFile(path.join(journalsDir, '2024-06-02.md'), '# two')

    const probe = await probeJournalShadowResyncNeeded(
      fileSystem,
      path.join(tempDir, 'Journals'),
      1
    )
    expect(probe.needsResync).toBe(true)
    expect(probe.diskCount).toBe(2)
    expect(probe.shadowCount).toBe(1)
  })

  it('returns no resync when counts match', async () => {
    const journalsDir = path.join(tempDir, 'Journals', '2024', '06')
    await fs.mkdir(journalsDir, { recursive: true })
    await fs.writeFile(path.join(journalsDir, '2024-06-01.md'), '# one')

    const probe = await probeJournalShadowResyncNeeded(
      fileSystem,
      path.join(tempDir, 'Journals'),
      1
    )
    expect(probe.needsResync).toBe(false)
  })

  it('honors forceResync', async () => {
    const probe = await probeJournalShadowResyncNeeded(
      fileSystem,
      path.join(tempDir, 'Journals'),
      5,
      { forceResync: true }
    )
    expect(probe.needsResync).toBe(true)
    expect(probe.reason).toBe('forced')
  })

  it('requests resync when journals dir is unavailable', async () => {
    const probe = await probeJournalShadowResyncNeeded(
      fileSystem,
      path.join(tempDir, 'missing', 'Journals'),
      3
    )
    expect(probe.needsResync).toBe(true)
    expect(probe.reason).toBe('journals-dir-unavailable')
  })

  it('does not request resync when duplicate files share the same calendar day', async () => {
    const journalsRoot = path.join(tempDir, 'Journals')
    const canonicalDir = path.join(journalsRoot, '2024', '06')
    await fs.mkdir(canonicalDir, { recursive: true })
    await fs.writeFile(path.join(journalsRoot, '2024-06-01.md'), '# flat')
    await fs.writeFile(path.join(canonicalDir, '2024-06-01.md'), '# canonical')

    const probe = await probeJournalShadowResyncNeeded(fileSystem, journalsRoot, 1)

    expect(probe.needsResync).toBe(false)
    expect(probe.diskCount).toBe(1)
  })
})
