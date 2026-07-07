import {
  path,
  VaultService,
  type IFileSystem,
  type IStoragePathService,
  type SessionManagerService,
  type SummarySyncService,
  type SessionFileService,
  type SessionSyncService
} from '@baishou/core-mobile'
import { isUsingExternalVaultDirectory } from '@baishou/shared'
import { mobileDataBootstrapper } from './mobile-bootstrapper.service'
import {
  bindShadowVaultScanState,
  getShadowVaultScanning
} from './mobile-shadow-scan-state.service'
import { vaultFileWatcher } from './vault-file-watcher.service'
import type { MobileExternalPathService } from './mobile-external-vault-paths.service'
import { sessionFileWatcher } from './session-file-watcher.service'
import { summaryFileWatcher } from './summary-file-watcher.service'
import type { VaultBoundDiaryStack } from './mobile-vault-runtime.types'

export type VaultRuntimeWatcherDeps = {
  pathService: IStoragePathService
  fileSystem: IFileSystem
  sessionFileService: SessionFileService
  sessionSyncService: SessionSyncService
  sessionManager: SessionManagerService
  summarySyncService: SummarySyncService
}

export async function restartVaultWatchers(
  diaryStack: VaultBoundDiaryStack,
  vaultService: VaultService,
  watcherDeps: VaultRuntimeWatcherDeps,
  options?: { skipSessionSummary?: boolean }
): Promise<void> {
  const activeVault = vaultService.getActiveVault()
  if (!activeVault?.path) {
    vaultFileWatcher.stop()
    sessionFileWatcher.stop()
    summaryFileWatcher.stop()
    return
  }

  const journalsDir = await watcherDeps.pathService.getJournalsBaseDirectory()
  const vaultDir = await watcherDeps.pathService.getVaultDirectory(activeVault.name)
  const externalJournals = await (
    watcherDeps.pathService as unknown as MobileExternalPathService
  ).getExternalJournalsDirectory(activeVault.name)
  const defaultJournalsDir = path.join(vaultDir, 'Journals')
  const isExternalJournals = isUsingExternalVaultDirectory(
    externalJournals,
    journalsDir,
    defaultJournalsDir
  )

  vaultFileWatcher.start(
    journalsDir,
    {
      shadowIndexSyncService: diaryStack.shadowIndexSyncService,
      fileSystem: watcherDeps.fileSystem
    },
    { createIfMissing: !isExternalJournals }
  )
  bindShadowVaultScanState(diaryStack.shadowIndexSyncService)

  if (options?.skipSessionSummary) {
    sessionFileWatcher.stop()
    summaryFileWatcher.stop()
    return
  }

  const sessionsDir = await watcherDeps.pathService.getSessionsBaseDirectory()
  void startSessionFileWatcherWhenStorageQuiet(sessionsDir, {
    sessionFileService: watcherDeps.sessionFileService,
    sessionSyncService: watcherDeps.sessionSyncService,
    fileSystem: watcherDeps.fileSystem
  })

  void startSummaryFileWatcherWhenStorageQuiet(watcherDeps.summarySyncService)
}

async function startSummaryFileWatcherWhenStorageQuiet(
  summarySync: SummarySyncService
): Promise<void> {
  await mobileDataBootstrapper.waitUntilIdle()
  while (getShadowVaultScanning()) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  summaryFileWatcher.start(summarySync)
}

async function startSessionFileWatcherWhenStorageQuiet(
  sessionsDir: string,
  deps: {
    sessionFileService: SessionFileService
    sessionSyncService: SessionSyncService
    fileSystem: IFileSystem
  }
): Promise<void> {
  await mobileDataBootstrapper.waitUntilIdle()
  while (getShadowVaultScanning()) {
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  sessionFileWatcher.start(sessionsDir, deps)
}
