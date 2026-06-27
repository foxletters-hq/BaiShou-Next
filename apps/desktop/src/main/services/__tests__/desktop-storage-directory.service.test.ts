import { beforeEach, describe, expect, it, vi } from 'vitest'

const pathServiceMock = vi.hoisted(() => ({
  getRootDirectory: vi.fn()
}))

const dbInstanceMock = vi.hoisted(() => ({ id: 'agent-db' }))

const dbMock = vi.hoisted(() => ({
  getAppDb: vi.fn(() => dbInstanceMock),
  resetAppDb: vi.fn()
}))

const databaseMock = vi.hoisted(() => ({
  connectionManager: {
    setDb: vi.fn()
  },
  installDatabaseSchema: vi.fn(),
  shadowConnectionManager: {
    disconnect: vi.fn()
  }
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('@baishou/core-desktop', () => ({
  copyStorageRootContents: vi.fn(),
  targetDirectoryHasData: vi.fn(),
  validateStorageDirectoryWritable: vi.fn()
}))

vi.mock('@baishou/shared', () => ({
  isPathInsideStorageRoot: vi.fn(),
  isSameStorageRoot: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('@baishou/database-desktop', () => databaseMock)

vi.mock('../../ipc/vault.ipc', () => ({
  pathService: pathServiceMock,
  vaultService: { initRegistry: vi.fn() },
  connectGlobalShadowDb: vi.fn()
}))

vi.mock('../node-file-system', () => ({
  fileSystem: {}
}))

const invalidateMcpToolContextCacheMock = vi.hoisted(() => vi.fn())

vi.mock('../../ipc/settings.ipc', () => ({
  settingsManager: {
    flushToDisk: vi.fn(),
    fullResyncFromDisk: vi.fn()
  }
}))

vi.mock('../../ipc/agent-helpers', () => ({
  invalidateMcpToolContextCache: invalidateMcpToolContextCacheMock
}))

vi.mock('../vault-resync.service', () => ({
  scheduleVaultEcosystemResync: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../bootstrapper.service', () => ({
  globalBootstrapper: {
    activateVaultRuntime: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../shadow-sync.registry', () => ({
  resetSharedShadowSync: vi.fn()
}))

vi.mock('../../ipc/attachment-path-cache', () => ({
  resetAttachmentAllowedRootsCache: vi.fn()
}))

vi.mock('../diary-watcher.service', () => ({
  diaryWatcher: { stop: vi.fn(), start: vi.fn() }
}))

vi.mock('../summary-watcher.service', () => ({
  summaryWatcher: { stop: vi.fn(), start: vi.fn() }
}))

vi.mock('../session-watcher.service', () => ({
  sessionWatcher: { stop: vi.fn(), start: vi.fn() }
}))

vi.mock('../../ipc/incremental-sync.ipc', () => ({
  resetSyncService: vi.fn()
}))

vi.mock('../../ipc/git-sync.ipc', () => ({
  resetGitService: vi.fn()
}))

vi.mock('../mcp-runtime', () => ({
  getMcpService: vi.fn(() => ({ running: false, stop: vi.fn().mockResolvedValue(undefined) })),
  bootstrapMcpServer: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../desktop-legacy-bootstrap.service', () => ({
  resolvePickedStorageDirectory: vi.fn((p: string) => p)
}))

vi.mock('../../db', () => dbMock)

describe('desktop-storage-directory.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pathServiceMock.getRootDirectory.mockResolvedValue('D:/new-workspace')
  })

  it('reconnects Agent DB for the current storage root', async () => {
    const { reconnectAgentDbForCurrentStorageRoot } =
      await import('../desktop-storage-directory.service')

    await reconnectAgentDbForCurrentStorageRoot()

    expect(dbMock.resetAppDb).toHaveBeenCalledTimes(1)
    expect(dbMock.getAppDb).toHaveBeenCalledWith('D:/new-workspace')
    expect(databaseMock.connectionManager.setDb).toHaveBeenCalledWith(dbInstanceMock)
    expect(databaseMock.installDatabaseSchema).toHaveBeenCalledWith(dbInstanceMock)
  })

  it('resyncs settings from disk before restarting MCP after storage resume', async () => {
    const mcpRuntime = await import('../mcp-runtime')
    const { settingsManager } = await import('../../ipc/settings.ipc')

    vi.mocked(mcpRuntime.getMcpService).mockReturnValue({
      running: true,
      stop: vi.fn().mockResolvedValue(undefined)
    } as never)

    const { quiesceStorageForFileCopy, resumeStorageAfterFileCopy } =
      await import('../desktop-storage-directory.service')

    await quiesceStorageForFileCopy()
    await resumeStorageAfterFileCopy()

    expect(settingsManager.fullResyncFromDisk).toHaveBeenCalledBefore(
      mcpRuntime.bootstrapMcpServer as never
    )
    expect(invalidateMcpToolContextCacheMock).toHaveBeenCalled()
    expect(mcpRuntime.bootstrapMcpServer).toHaveBeenCalled()
  })
})
