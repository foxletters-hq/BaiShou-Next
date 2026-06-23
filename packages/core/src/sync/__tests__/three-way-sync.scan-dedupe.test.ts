import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ThreeWaySyncService } from '../three-way-sync.service'
import { buildVaultJournalsSyncPrefix } from '@baishou/shared'
import type { ICloudSyncClient } from '../../network/cloud-sync.interface'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('ThreeWaySyncCore.scanLocalFiles in-root external dedupe', () => {
  let syncRoot: string
  let service: ThreeWaySyncService

  const cloudClient = {
    listFiles: vi.fn().mockResolvedValue([]),
    uploadFile: vi.fn(),
    downloadFile: vi.fn(),
    deleteFile: vi.fn()
  } as unknown as ICloudSyncClient

  const pathService = {
    getRootDirectory: vi.fn(),
    getActiveVaultPath: vi.fn()
  } as unknown as IStoragePathService

  beforeEach(async () => {
    syncRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'incr-scan-dedupe-'))
    vi.mocked(pathService.getRootDirectory).mockResolvedValue(syncRoot)
    vi.mocked(pathService.getActiveVaultPath).mockResolvedValue(path.join(syncRoot, 'Personal'))
    service = new ThreeWaySyncService(pathService, cloudClient, 'desktop-test')

    await fs.mkdir(path.join(syncRoot, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(syncRoot, '.baishou-s3.json'),
      JSON.stringify({
        enabled: false,
        target: 's3',
        endpoint: '',
        region: 'us-east-1',
        bucket: 'bucket-a',
        path: 'backup_sync',
        accessKey: '',
        secretKey: ''
      }),
      'utf8'
    )
  })

  afterEach(async () => {
    await fs.rm(syncRoot, { recursive: true, force: true }).catch(() => null)
  })

  it('excludes literal in-root external subtree and keeps virtual Journals paths only', async () => {
    const inRootExternal = path.join(syncRoot, 'Personal', 'Obsidian', 'journals')
    await fs.mkdir(path.join(inRootExternal, '2024', '06'), { recursive: true })
    await fs.writeFile(path.join(inRootExternal, '2024', '06', '2024-06-01.md'), '# diary', 'utf8')

    const vaultDir = path.join(syncRoot, 'Personal')
    await fs.mkdir(path.join(vaultDir, '.baishou'), { recursive: true })
    await fs.writeFile(
      path.join(vaultDir, '.baishou', 'external_paths.json'),
      JSON.stringify({ journalsDirectory: inRootExternal }),
      'utf8'
    )

    const files = await (service as unknown as { scanLocalFiles: () => Promise<string[]> }).scanLocalFiles()

    expect(files).toContain(`${buildVaultJournalsSyncPrefix('Personal')}/2024/06/2024-06-01.md`)
    expect(files.some((rel) => rel.includes('Obsidian/journals'))).toBe(false)
    expect(files.some((rel) => rel.includes('Obsidian\\journals'))).toBe(false)
  })
})
