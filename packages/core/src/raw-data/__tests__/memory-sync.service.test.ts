import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { MemoryRawManager } from '../managers/memory.raw-manager'
import { MemorySyncService } from '../memory-sync.service'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('MemorySyncService', () => {
  let tmpDir: string
  let memoryManager: MemoryRawManager

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mem-sync-'))
    const freshness = new DerivedFreshnessService()
    const pathService = {
      getMemoryBaseDirectory: async () => path.join(tmpDir, 'Memory')
    } as unknown as IStoragePathService
    memoryManager = new MemoryRawManager(pathService, new NodeFileSystem(), freshness)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('embeds pending rows and deletes tombstones + orphan db ids', async () => {
    const now = Date.now()
    await memoryManager.writeRecord({
      id: 'a',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'hello',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await memoryManager.writeRecord({
      id: 'b',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'bye',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now + 1,
      deletedAt: now + 1
    })

    const embedText = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const listSourceIdsByType = vi.fn().mockResolvedValue(['a', 'b', 'orphan'])

    const sync = new MemorySyncService(memoryManager, {
      embedText,
      deleteBySource,
      listSourceIdsByType
    })
    const result = await sync.syncPendingIndex()

    expect(result.shards).toBe(1)
    expect(embedText).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'a', text: 'hello' })
    )
    expect(deleteBySource).toHaveBeenCalledWith('memory', 'b')
    expect(deleteBySource).toHaveBeenCalledWith('memory', 'orphan')
    expect(await memoryManager.listPendingIndex()).toHaveLength(0)
  })
})
