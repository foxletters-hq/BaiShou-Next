import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEmitSyncMutation = vi.fn()
const mockImportDeepSeekSessions = vi.fn()
const mockScanDeepSeekExtractedArchive = vi.fn()
const mockStageZipForUnzip = vi.fn()
const mockUnzip = vi.fn()
const mockNativeUnzipArchive = vi.fn()

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' }
}))

vi.mock('react-native-zip-archive', () => ({
  unzip: (...args: unknown[]) => mockUnzip(...args)
}))

vi.mock('expo-baishou-server', () => ({
  isNativeArchiveImportAvailable: () => false,
  nativeUnzipArchive: (...args: unknown[]) => mockNativeUnzipArchive(...args)
}))

vi.mock('@baishou/core-mobile', () => ({
  importDeepSeekSessions: (...args: unknown[]) => mockImportDeepSeekSessions(...args),
  scanDeepSeekExtractedArchive: (...args: unknown[]) => mockScanDeepSeekExtractedArchive(...args)
}))

vi.mock('../archive-import.helpers', () => ({
  stageZipForUnzip: (...args: unknown[]) => mockStageZipForUnzip(...args)
}))

vi.mock('../mobile-app-paths', () => ({
  getAppCacheDirectory: () => 'file:///mock-cache/'
}))

vi.mock('../../cache/mobile-cache-coordinator', () => ({
  emitSyncMutation: (...args: unknown[]) => mockEmitSyncMutation(...args)
}))

describe('mobile-deepseek-import.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should extract zip, scan archive, and clean up extracted directory on failure', async () => {
    const rm = vi.fn(async () => {})
    const mkdir = vi.fn(async () => {})
    const cleanupStagedZip = vi.fn(async () => {})
    mockStageZipForUnzip.mockResolvedValue({
      nativeZipPath: '/mock-cache/staged.zip',
      cleanupStagedZip
    })
    mockUnzip.mockResolvedValue('/mock-cache/extract')
    mockScanDeepSeekExtractedArchive.mockRejectedValue(new Error('invalid archive'))

    const { extractAndScanMobileDeepSeekZip } = await import('../mobile-deepseek-import.service')
    await expect(
      extractAndScanMobileDeepSeekZip({ mkdir, rm } as never, 'content://picked/deepseek.zip')
    ).rejects.toThrow('invalid archive')

    expect(cleanupStagedZip).toHaveBeenCalledTimes(1)
    expect(rm).toHaveBeenCalledTimes(1)
  })

  it('should resolve active vault, delegate import, and emit sync mutation when sessions imported', async () => {
    mockImportDeepSeekSessions.mockResolvedValue({
      assistantId: 'ast-1',
      assistantName: 'DeepSeek',
      createdNewAssistant: true,
      importedSessions: 3,
      importedMessages: 14,
      importedAttachments: 0,
      skippedSessions: 0,
      failedSessions: 0,
      failureSamples: [],
      importedSessionIds: ['ds_1', 'ds_2', 'ds_3'],
      firstImportedSessionId: 'ds_1'
    })

    const { executeMobileDeepSeekImport } = await import('../mobile-deepseek-import.service')
    const services = {
      fileSystem: {},
      sessionRepo: {},
      sessionManager: {},
      assistantManager: {},
      vaultService: {
        getActiveVault: () => ({ id: 'v_123', name: 'Personal' })
      },
      pathService: {
        getActiveVaultNameForContext: vi.fn(async () => 'Personal'),
        getAttachmentsBaseDirectory: vi.fn(async () => '/vault/Personal/Attachments')
      }
    }

    const res = await executeMobileDeepSeekImport(services as never, {
      scanResult: {
        format: 'v3',
        exportFormatVersion: 3,
        payloadDir: '/cache/extract',
        sessions: [],
        totalMessages: 0,
        earliestAt: null,
        latestAt: null,
        warnings: []
      },
      selectedSessionIds: ['s1'],
      target: { mode: 'new', name: 'DeepSeek' }
    })

    expect(res.importedSessions).toBe(3)
    expect(mockImportDeepSeekSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        fileSystem: services.fileSystem,
        sessionRepo: services.sessionRepo,
        sessionManager: services.sessionManager,
        assistantManager: services.assistantManager
      }),
      expect.objectContaining({
        vaultId: 'v_123',
        vaultName: 'Personal',
        attachmentsBaseDir: '/vault/Personal/Attachments'
      })
    )
    expect(mockEmitSyncMutation).toHaveBeenCalledWith('resync-complete', 'deepseek-import')
  })

  it('should not emit sync mutation when nothing was imported and no assistant created', async () => {
    mockImportDeepSeekSessions.mockResolvedValue({
      assistantId: 'ast-existing',
      assistantName: 'Latte',
      createdNewAssistant: false,
      importedSessions: 0,
      importedMessages: 0,
      importedAttachments: 0,
      skippedSessions: 2,
      failedSessions: 0,
      failureSamples: [],
      importedSessionIds: [],
      firstImportedSessionId: null
    })

    const { executeMobileDeepSeekImport } = await import('../mobile-deepseek-import.service')
    const services = {
      fileSystem: {},
      sessionRepo: {},
      sessionManager: {},
      assistantManager: {},
      vaultService: { getActiveVault: () => ({ id: 'v_1', name: 'Personal' }) },
      pathService: {
        getActiveVaultNameForContext: vi.fn(async () => 'Personal'),
        getAttachmentsBaseDirectory: vi.fn(async () => '/vault/Personal/Attachments')
      }
    }

    await executeMobileDeepSeekImport(services as never, {
      scanResult: {
        format: 'v3',
        exportFormatVersion: 3,
        payloadDir: '/cache/extract',
        sessions: [],
        totalMessages: 0,
        earliestAt: null,
        latestAt: null,
        warnings: []
      },
      selectedSessionIds: ['s1'],
      target: { mode: 'existing', assistantId: 'ast-existing', assistantName: 'Latte' }
    })

    expect(mockEmitSyncMutation).not.toHaveBeenCalled()
  })
})
