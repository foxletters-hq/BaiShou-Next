import {
  VaultService,
  type IFileSystem,
  type IStoragePathService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService
} from '@baishou/core-mobile'
import type { MobileBootstrapperDeps } from './mobile-bootstrapper.service'
import { createVaultBoundDiaryStack } from './mobile-vault-diary-stack.helpers'
import { runVaultBootstrap } from './mobile-vault-bootstrap.helpers'
import { restartVaultWatchers, type VaultRuntimeWatcherDeps } from './mobile-vault-watcher.helpers'
import { bumpVaultRuntimeGeneration } from './mobile-vault-runtime-state.helpers'
import type {
  VaultBoundDiaryStack,
  VaultSwitchCallbacks,
  ActivateVaultRuntimeOptions
} from './mobile-vault-runtime.types'
import { prepareVaultSwitch } from './mobile-vault-runtime-lifecycle'

export async function activateVaultRuntime(
  deps: {
    pathService: IStoragePathService
    vaultService: VaultService
    fileSystem: IFileSystem
    diaryStack: VaultBoundDiaryStack
    bootstrapDeps: Omit<
      MobileBootstrapperDeps,
      | 'shadowIndexSyncService'
      | 'sessionManager'
      | 'assistantManager'
      | 'settingsManager'
      | 'summarySyncService'
    > & {
      sessionManager: SessionManagerService
      assistantManager: AssistantManagerService
      settingsManager: SettingsManagerService
      summarySyncService: SummarySyncService
    }
    watcherDeps: VaultRuntimeWatcherDeps
  },
  options?: ActivateVaultRuntimeOptions
): Promise<void> {
  await runVaultBootstrap(deps, {
    deferResync: options?.deferResync ?? true,
    forceDeferResync: options?.forceDeferResync,
    forceShadowResync: options?.forceShadowResync,
    resyncReason: options?.resyncReason ?? 'cold-start',
    onResyncComplete: options?.onResyncComplete
  })
}

let vaultSwitchInFlight: Promise<VaultBoundDiaryStack> | null = null

export async function switchVaultRuntime(
  vaultName: string,
  deps: {
    pathService: IStoragePathService
    vaultService: VaultService
    fileSystem: IFileSystem
    bootstrapDeps: Omit<MobileBootstrapperDeps, 'shadowIndexSyncService'>
    watcherDeps: VaultRuntimeWatcherDeps
    currentStack?: VaultBoundDiaryStack
    callbacks?: VaultSwitchCallbacks
  }
): Promise<VaultBoundDiaryStack> {
  if (vaultSwitchInFlight) {
    try {
      await vaultSwitchInFlight
    } catch {
      // 上一次切换失败，允许继续
    }
  }

  const switchTask = (async () => {
    bumpVaultRuntimeGeneration()
    await prepareVaultSwitch(deps.currentStack, {
      sessionManager: deps.bootstrapDeps.sessionManager
    })

    const active = deps.vaultService.getActiveVault()
    if (active?.name === vaultName && deps.currentStack) {
      await restartVaultWatchers(deps.currentStack, deps.vaultService, deps.watcherDeps)
      return deps.currentStack
    }

    await deps.vaultService.switchVault(vaultName)

    const { resetMobileRawDataRuntime, ensureMobileRawDataRuntime } =
      await import('./mobile-raw-data-source.runtime')
    resetMobileRawDataRuntime()
    ensureMobileRawDataRuntime({
      pathService: deps.pathService,
      fileSystem: deps.fileSystem
    })

    deps.callbacks?.onStackInvalidated?.()

    const diaryStack = createVaultBoundDiaryStack({
      pathService: deps.pathService,
      vaultService: deps.vaultService,
      fileSystem: deps.fileSystem,
      settingsManager: deps.bootstrapDeps.settingsManager
    })
    deps.callbacks?.onStackReady?.(diaryStack)

    await runVaultBootstrap(
      {
        pathService: deps.pathService,
        vaultService: deps.vaultService,
        fileSystem: deps.fileSystem,
        diaryStack,
        bootstrapDeps: deps.bootstrapDeps,
        watcherDeps: deps.watcherDeps
      },
      {
        deferResync: true,
        resyncReason: `vault-switch:${vaultName}`,
        onResyncComplete: deps.callbacks?.onResyncComplete
      }
    )

    return diaryStack
  })()

  vaultSwitchInFlight = switchTask
  try {
    return await switchTask
  } finally {
    if (vaultSwitchInFlight === switchTask) {
      vaultSwitchInFlight = null
    }
  }
}
