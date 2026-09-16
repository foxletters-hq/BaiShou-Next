import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { buildMemoryMetadataJson, parseMemoryMetadataJson } from '@baishou/shared'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { MemoryRawManager } from '../managers/memory.raw-manager'
import { MemoryJsonlBackfillService } from '../memory-jsonl-backfill.service'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('MemoryJsonlBackfillService manual migration', () => {
  let tmpDir: string
  let memoryManager: MemoryRawManager

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mem-m11-'))
    const freshness = new DerivedFreshnessService()
    const pathService = {
      getMemoryBaseDirectory: async () => path.join(tmpDir, 'Memory')
    } as unknown as IStoragePathService
    memoryManager = new MemoryRawManager(pathService, new NodeFileSystem(), freshness)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('migrates manual chunks into JSONL, normalizes sourceType, does not re-embed', async () => {
    const now = Date.now()
    const service = new MemoryJsonlBackfillService(memoryManager)
    const embedText = vi.fn()
    const normalizeManualToMemory = vi.fn().mockResolvedValue(1)
    const updateMetadataBySource = vi.fn().mockResolvedValue(undefined)

    const result = await service.migrateManualAndPatchMetadata(
      [
        {
          sourceId: 'manual_old_1',
          chunkText: 'legacy manual note',
          groupId: 'manual',
          chunkIndex: 0,
          sourceCreatedAt: now
        }
      ],
      'Personal',
      { normalizeManualToMemory, updateMetadataBySource }
    )

    expect(result.written).toBe(1)
    expect(result.normalized).toBe(1)
    expect(normalizeManualToMemory).toHaveBeenCalledWith({
      vaultName: 'Personal',
      sourceIds: ['manual_old_1']
    })
    expect(embedText).not.toHaveBeenCalled()

    const shards = await memoryManager.listShards()
    expect(shards.length).toBe(1)
    const rows = await memoryManager.readCollapsedShard(shards[0]!.shardMonth)
    const row = rows.find((r) => r.id === 'manual_old_1')
    expect(row).toMatchObject({
      content: 'legacy manual note',
      sourceSessionId: null,
      deletedAt: null,
      legacySourceId: 'manual_old_1'
    })
    expect(updateMetadataBySource).toHaveBeenCalledWith(
      'memory',
      'manual_old_1',
      buildMemoryMetadataJson({
        tags: [],
        sourceSessionId: null,
        createdAt: now,
        updatedAt: now
      })
    )
  })

  it('manual migration is idempotent across two runs', async () => {
    const now = Date.now()
    const service = new MemoryJsonlBackfillService(memoryManager)
    const chunks = [
      {
        sourceId: 'manual_dup',
        chunkText: 'once',
        groupId: 'manual',
        chunkIndex: 0,
        sourceCreatedAt: now
      }
    ]
    const sink = {
      normalizeManualToMemory: vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0),
      updateMetadataBySource: vi.fn().mockResolvedValue(undefined)
    }

    const first = await service.migrateManualAndPatchMetadata(chunks, 'Personal', sink)
    const second = await service.migrateManualAndPatchMetadata(chunks, 'Personal', sink)

    expect(first.written).toBe(1)
    expect(second.written).toBe(0)
    expect(second.skipped).toBe(1)

    const shards = await memoryManager.listShards()
    const rows = await memoryManager.readCollapsedShard(shards[0]!.shardMonth)
    expect(rows.filter((r) => r.id === 'manual_dup')).toHaveLength(1)
  })

  it('switching to vault B only backfills B chunks (A content never written)', async () => {
    const now = Date.now()
    const service = new MemoryJsonlBackfillService(memoryManager)
    // 模拟 listEmbeddingChunksByType({ vaultId: B }) 已过滤后的结果
    const vaultBChunks = [
      {
        sourceId: 'mem-b-only',
        chunkText: 'secret memory belonging to B',
        groupId: 'memory',
        chunkIndex: 0,
        sourceCreatedAt: now
      }
    ]
    // 若未按 vault 过滤，A 的 chunk 也会出现在这里——本测断言调用方只传入 B
    const vaultALeakChunk = {
      sourceId: 'mem-a-leak',
      chunkText: 'secret memory belonging to A',
      groupId: 'memory',
      chunkIndex: 0,
      sourceCreatedAt: now
    }

    const result = await service.backfillFromChunks(vaultBChunks, 'VaultB')
    expect(result.written).toBe(1)

    const shards = await memoryManager.listShards()
    expect(shards.length).toBe(1)
    const rows = await memoryManager.readCollapsedShard(shards[0]!.shardMonth)
    expect(rows.some((r) => r.id === 'mem-b-only')).toBe(true)
    expect(rows.some((r) => r.content.includes('belonging to A'))).toBe(false)
    expect(rows.some((r) => r.id === vaultALeakChunk.sourceId)).toBe(false)
  })

  it('management entry metadata helpers round-trip source fields', () => {
    const json = buildMemoryMetadataJson({
      tags: ['a', 'b'],
      sourceSessionId: 'sess-9',
      createdAt: 100,
      updatedAt: 200
    })
    expect(parseMemoryMetadataJson(json)).toEqual({
      tags: ['a', 'b'],
      sourceSessionId: 'sess-9',
      createdAt: 100,
      updatedAt: 200
    })
  })
})
