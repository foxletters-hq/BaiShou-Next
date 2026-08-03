import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { deriveLegacyVaultId, MEMORY_EMBED_GROUP_ID } from '@baishou/shared'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { MemoryRawManager } from '../managers/memory.raw-manager'
import { MemorySyncService } from '../memory-sync.service'
import { shardMonthFromInstant } from '../raw-data-month.util'
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
    expect(listSourceIdsByType).toHaveBeenCalledWith('memory', {
      groupId: MEMORY_EMBED_GROUP_ID,
      vaultId: deriveLegacyVaultId('Personal')
    })
    expect(await memoryManager.listPendingIndex()).toHaveLength(0)
  })

  it('cleans orphan db ids even when no pending shards', async () => {
    const now = Date.now()
    const written = await memoryManager.writeRecord({
      id: 'live',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'x',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await memoryManager.commitIndexed(written.relativePath, written.contentHash)

    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const listSourceIdsByType = vi.fn().mockResolvedValue(['live', 'orphan'])
    const sync = new MemorySyncService(memoryManager, {
      embedText: vi.fn(),
      deleteBySource,
      listSourceIdsByType
    })
    const result = await sync.syncPendingIndex()

    expect(result.shards).toBe(0)
    expect(listSourceIdsByType).toHaveBeenCalledWith('memory', {
      groupId: MEMORY_EMBED_GROUP_ID,
      vaultId: deriveLegacyVaultId('Personal')
    })
    expect(deleteBySource).toHaveBeenCalledWith('memory', 'orphan')
    expect(deleteBySource).not.toHaveBeenCalledWith('memory', 'live')
  })

  it('tombstoned memory does not revive after syncPendingIndex', async () => {
    const now = Date.now()
    await memoryManager.writeRecord({
      id: 'keep',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'stay',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    await memoryManager.writeRecord({
      id: 'gone',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'forget me',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    const embedText = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const listSourceIdsByType = vi.fn().mockResolvedValue(['keep', 'gone'])
    const sync = new MemorySyncService(memoryManager, {
      embedText,
      deleteBySource,
      listSourceIdsByType
    })
    await sync.syncPendingIndex()

    await memoryManager.tombstone('gone', { shardMonth: shardMonthFromInstant(now) })
    // Simulate management-page delete already dropping derived rows for `gone`
    listSourceIdsByType.mockResolvedValue(['keep'])
    embedText.mockClear()
    deleteBySource.mockClear()

    await sync.syncPendingIndex()

    expect(embedText).not.toHaveBeenCalledWith(expect.objectContaining({ sourceId: 'gone' }))
    expect(deleteBySource).toHaveBeenCalledWith('memory', 'gone')
    expect(embedText).not.toHaveBeenCalledWith(expect.objectContaining({ text: 'forget me' }))
  })

  it('edited memory content wins after syncPendingIndex rebuild', async () => {
    const now = Date.now()
    await memoryManager.writeRecord({
      id: 'm1',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'old content',
      tags: ['tag'],
      sourceSessionId: 'sess-1',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })

    const embedText = vi.fn().mockResolvedValue(undefined)
    const deleteBySource = vi.fn().mockResolvedValue(undefined)
    const listSourceIdsByType = vi.fn().mockResolvedValue(['m1'])
    const sync = new MemorySyncService(memoryManager, {
      embedText,
      deleteBySource,
      listSourceIdsByType
    })
    await sync.syncPendingIndex()

    await memoryManager.writeRecord({
      id: 'm1',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'new content',
      tags: ['tag'],
      sourceSessionId: 'sess-1',
      createdAt: now,
      updatedAt: now + 1000,
      deletedAt: null
    })
    embedText.mockClear()

    await sync.syncPendingIndex()

    expect(embedText).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'm1', text: 'new content' })
    )
    expect(embedText).not.toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'm1', text: 'old content' })
    )
  })
})
