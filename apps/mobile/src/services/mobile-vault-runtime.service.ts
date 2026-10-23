export type {
  VaultDiarySearcher,
  VaultBoundDiaryStack,
  VaultSwitchCallbacks,
  ActivateVaultRuntimeOptions,
  StorageRootRebootstrapOptions
} from './mobile-vault-runtime.types'
export type { VaultRuntimeWatcherDeps } from './mobile-vault-watcher.helpers'
export {
  EMPTY_DIARY_REPO_ADAPTER,
  EMPTY_DIARY_SEARCHER,
  createUnavailableDiaryService,
  createVaultDiaryServiceProxy
} from './mobile-vault-runtime-placeholders'
export {
  initVaultLayer,
  connectGlobalShadowDb,
  stopVaultWatchers,
  prepareVaultSwitch,
  quiesceStorageForFileCopy,
  resumeStorageAfterFileCopy,
  resyncEcosystemAfterFileMutation,
  rebootstrapAfterStorageRootChange,
  registerVaultBootstrapDeps
} from './mobile-vault-runtime-lifecycle'
export { activateVaultRuntime, switchVaultRuntime } from './mobile-vault-runtime-switch'
export {
  deleteVaultWithShadowCleanup,
  clearAllVaultShadowIndexes
} from './mobile-vault-runtime-cleanup'
