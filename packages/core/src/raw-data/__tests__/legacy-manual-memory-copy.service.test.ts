import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { MemoryRawManager } from '../managers/memory.raw-manager'
import {
  LegacyManualMemoryCopyService,
  isLegacyManualMemoryOriginal
} from '../legacy-manual-memory-copy.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { MemoryRawRecord } from '@baishou/shared'

function createManager(memoryRoot: string, freshness: DerivedFreshnessService): MemoryRawManager {
  const pathService = {
    getMemoryBaseDirectory: async () => memoryRoot
  } as unknown as IStoragePathService
  return new MemoryRawManager(pathService, new NodeFileSystem(), freshness)
}

describe('LegacyManualMemoryCopyService (V1.6)', () => {
  let tmpDir: string
  let freshness: DerivedFreshnessService
  let mgrA: MemoryRawManager
  let mgrB: MemoryRawManager
  let mgrC: MemoryRawManager

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mem-v16-'))
    freshness = new DerivedFreshnessService()
    mgrA = createManager(path.join(tmpDir, 'A', 'Memory'), freshness)
    mgrB = createManager(path.join(tmpDir, 'B', 'Memory'), freshness)
    mgrC = createManager(path.join(tmpDir, 'C', 'Memory'), freshness)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('isLegacyManualMemoryOriginal requires legacySourceId + null session + not a copy', () => {
    const base: MemoryRawRecord = {
      id: 'manual_1',
      schemaVersion: 1,
      vaultName: 'A',
      content: 'x',
      tags: [],
      sourceSessionId: null,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      legacySourceId: 'manual_1'
    }
    expect(isLegacyManualMemoryOriginal(base)).toBe(true)
    expect(isLegacyManualMemoryOriginal({ ...base, sourceSessionId: 'sess' })).toBe(false)
    expect(isLegacyManualMemoryOriginal({ ...base, legacySourceId: undefined })).toBe(false)
    expect(isLegacyManualMemoryOriginal({ ...base, derivedFromLegacyId: 'manual_1' })).toBe(false)
    expect(isLegacyManualMemoryOriginal({ ...base, deletedAt: 9 })).toBe(false)
  })

  it('copies legacy originals to every other vault and leaves source untouched', async () => {
    const now = Date.now()
    await mgrA.writeRecord({
      id: 'manual_old',
      schemaVersion: 1,
      vaultId: 'vault-a',
      vaultName: 'A',
      content: 'shared note',
      tags: ['t1'],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      legacySourceId: 'manual_old'
    })
    await mgrA.writeRecord({
      id: 'session-mem',
      schemaVersion: 1,
      vaultId: 'vault-a',
      vaultName: 'A',
      content: 'from chat',
      tags: [],
      sourceSessionId: 'sess-1',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      legacySourceId: 'session-mem'
    })

    const afterWrite = vi.fn().mockResolvedValue(undefined)
    const service = new LegacyManualMemoryCopyService()
    let seq = 0
    const result = await service.copyToOtherVaults({
      vaults: [
        { id: 'vault-a', name: 'A' },
        { id: 'vault-b', name: 'B' },
        { id: 'vault-c', name: 'C' }
      ],
      getManager: (v) => {
        if (v.id === 'vault-a') return mgrA
        if (v.id === 'vault-b') return mgrB
        return mgrC
      },
      afterWrite,
      newId: () => `copy_${++seq}`
    })

    expect(result).toEqual({ originals: 1, copied: 2, skipped: 0 })
    expect(afterWrite).toHaveBeenCalledTimes(2)

    const aRows = await mgrA.readCollapsedShard((await mgrA.listShards())[0]!.shardMonth)
    const original = aRows.find((r) => r.id === 'manual_old')
    expect(original).toMatchObject({
      content: 'shared note',
      legacySourceId: 'manual_old'
    })
    expect(original?.derivedFromLegacyId).toBeUndefined()

    const bRows = await mgrB.readCollapsedShard((await mgrB.listShards())[0]!.shardMonth)
    const bCopy = bRows.find((r) => r.derivedFromLegacyId === 'manual_old')
    expect(bCopy).toMatchObject({
      id: 'copy_1',
      vaultId: 'vault-b',
      vaultName: 'B',
      content: 'shared note',
      tags: ['t1'],
      sourceSessionId: null,
      derivedFromLegacyId: 'manual_old'
    })
    expect(bCopy?.legacySourceId).toBeUndefined()

    const cRows = await mgrC.readCollapsedShard((await mgrC.listShards())[0]!.shardMonth)
    expect(cRows.find((r) => r.derivedFromLegacyId === 'manual_old')).toMatchObject({
      id: 'copy_2',
      vaultId: 'vault-c',
      vaultName: 'C'
    })
  })

  it('is idempotent when target already has derivedFromLegacyId', async () => {
    const now = Date.now()
    await mgrA.writeRecord({
      id: 'manual_once',
      schemaVersion: 1,
      vaultId: 'vault-a',
      vaultName: 'A',
      content: 'once',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      legacySourceId: 'manual_once'
    })

    const service = new LegacyManualMemoryCopyService()
    const opts = {
      vaults: [
        { id: 'vault-a', name: 'A' },
        { id: 'vault-b', name: 'B' }
      ],
      getManager: (v: { id: string }) => (v.id === 'vault-a' ? mgrA : mgrB),
      newId: () => 'copy_fixed'
    }

    const first = await service.copyToOtherVaults(opts)
    const second = await service.copyToOtherVaults(opts)

    expect(first).toEqual({ originals: 1, copied: 1, skipped: 0 })
    expect(second).toEqual({ originals: 1, copied: 0, skipped: 1 })

    const bShards = await mgrB.listShards()
    const bRows = await mgrB.readCollapsedShard(bShards[0]!.shardMonth)
    expect(bRows.filter((r) => r.derivedFromLegacyId === 'manual_once')).toHaveLength(1)
  })

  it('no-ops for single-vault users', async () => {
    const now = Date.now()
    await mgrA.writeRecord({
      id: 'manual_solo',
      schemaVersion: 1,
      vaultId: 'vault-a',
      vaultName: 'A',
      content: 'solo',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      legacySourceId: 'manual_solo'
    })

    const service = new LegacyManualMemoryCopyService()
    const afterWrite = vi.fn()
    const result = await service.copyToOtherVaults({
      vaults: [{ id: 'vault-a', name: 'A' }],
      getManager: () => mgrA,
      afterWrite
    })

    expect(result).toEqual({ originals: 0, copied: 0, skipped: 0 })
    expect(afterWrite).not.toHaveBeenCalled()
  })
})
