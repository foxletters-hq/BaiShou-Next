import { vi } from 'vitest'
import { DiaryService } from '../diary.service'
import { FileSyncService } from '../file-sync.service'
import { VaultIndexService } from '../vault-index.service'
import { ShadowIndexSyncService } from '../../shadow-index/shadow-index-sync.service'
import { ShadowIndexRepository } from '@baishou/database'

export function createDiaryServiceHarness() {
  const mockShadowRepo = {
    mountFTS: vi.fn(),
    upsert: vi.fn(),
    deleteById: vi.fn(),
    findByDatePrefix: vi.fn(),
    getHashByDate: vi.fn(),
    getAllRecords: vi.fn(),
    searchFTS: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findByDate: vi.fn(),
    listAll: vi.fn().mockResolvedValue([]),
    listForEmbedDetection: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0)
  } as any

  const mockFileSync = {
    writeJournal: vi.fn(),
    readJournal: vi.fn(),
    deleteJournalFile: vi.fn(),
    fullScanVault: vi.fn()
  }

  const mockShadowSync = {
    setSyncEnabled: vi.fn(),
    waitForScan: vi.fn(),
    onSyncEvent: vi.fn(),
    syncJournal: vi.fn(),
    fullScanVault: vi.fn()
  } as any

  const mockVaultIndex = {
    upsert: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    forceReload: vi.fn(),
    getAll: vi.fn()
  }

  const service = new DiaryService(mockShadowRepo, mockFileSync, mockShadowSync, mockVaultIndex)

  return {
    mockShadowRepo: mockShadowRepo as import('vitest').Mocked<ShadowIndexRepository>,
    mockFileSync: mockFileSync as import('vitest').Mocked<FileSyncService>,
    mockShadowSync: mockShadowSync as import('vitest').Mocked<ShadowIndexSyncService>,
    mockVaultIndex: mockVaultIndex as import('vitest').Mocked<VaultIndexService>,
    service
  }
}
