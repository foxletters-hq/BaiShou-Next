import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import {
  loadVaultExternalSyncMounts,
  scanVaultExternalSyncMountFiles
} from '../incremental-sync-external-mounts'
import { buildVaultJournalsSyncPrefix } from '@baishou/shared'

describe('incremental-sync-external-mounts', () => {
  let tempDir: string
  const fileSystem = createNodeFileSystem()

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'incr-ext-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => null)
  })

  it('loads journals external mount and scans virtual rel paths', async () => {
    const externalJournals = path.join(tempDir, 'external-journals')
    await fs.mkdir(path.join(externalJournals, '2024', '06'), { recursive: true })
    await fs.writeFile(path.join(externalJournals, '2024', '06', '2024-06-01.md'), '# diary')

    const vaultDir = path.join(tempDir, 'Personal')
    await fs.mkdir(path.join(vaultDir, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(vaultDir, '.baishou', 'external_paths.json'),
      JSON.stringify({ journalsDirectory: externalJournals }),
      'utf8'
    )

    const mounts = await loadVaultExternalSyncMounts(fileSystem, tempDir)
    expect(mounts).toHaveLength(1)
    expect(mounts[0]?.kind).toBe('journals')

    const scanned = await scanVaultExternalSyncMountFiles(fileSystem, mounts[0]!)
    expect(scanned).toHaveLength(1)
    expect(scanned[0]?.relPath).toBe(
      `${buildVaultJournalsSyncPrefix('Personal')}/2024/06/2024-06-01.md`
    )
  })
})
