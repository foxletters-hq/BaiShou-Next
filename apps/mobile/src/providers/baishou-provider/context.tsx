import { createContext, useContext } from 'react'
import { Platform } from 'react-native'
import type { BaishouContextValue } from './types'

export type { BaishouContextValue, StartAgentChatOverrides, BaishouProviderProps } from './types'

const BaishouContext = createContext<BaishouContextValue>({
  dbReady: false,
  storageReady: Platform.OS !== 'android',
  legacyRagReembedRequired: false,
  pendingFlutterLegacyMigration: null,
  legacyMigrationSourcePendingDeletion: null,
  deleteMigratedLegacySource: async () => false,
  vaultRevision: 0,
  notifyArchiveRestoreComplete: () => {},
  notifyVersionMigrationComplete: () => {},
  archiveRestoreEpoch: 0,
  vaultSwitching: false,
  storageIndexing: false,
  ecosystemResyncEpoch: 0,
  retryStorageSetup: async () => Platform.OS !== 'android',
  runWithStorageQuiesced: async (fn) => fn(),
  resyncAfterMigration: async () => {},
  services: null
})

export const useBaishou = () => useContext(BaishouContext)

export { BaishouContext }
