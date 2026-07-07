import type { SyncManifest } from '@baishou/shared'
import {
  IncrementalSyncCheckpointCoordinator,
  type SessionTouchState
} from './mobile-incremental-flush.util'

export type CheckpointRuntimeDelegate = {
  saveLocalManifest(manifest: SyncManifest): Promise<void>
  saveRemoteSnapshot(manifest: SyncManifest): Promise<void>
  flushRemoteManifestCheckpoint(): Promise<void>
  touchSyncSession(state: SessionTouchState): Promise<void>
}

export function createCheckpointRuntime(delegate: CheckpointRuntimeDelegate) {
  const coordinator = new IncrementalSyncCheckpointCoordinator()
  const saveLocal = (manifest: SyncManifest) => delegate.saveLocalManifest(manifest)
  const saveSnapshot = (manifest: SyncManifest) => delegate.saveRemoteSnapshot(manifest)
  const uploadRemote = () => delegate.flushRemoteManifestCheckpoint()
  const writeSession = (state: SessionTouchState) => delegate.touchSyncSession(state)
  const ensureLocalFlushed = () => coordinator.flushLocalIfNeeded(true, saveLocal, saveSnapshot)

  return {
    async afterMutation(manifest: SyncManifest) {
      coordinator.noteManifest(manifest)
      coordinator.noteRemoteCheckpoint()
      await coordinator.flushLocalIfNeeded(false, saveLocal, saveSnapshot)
      await coordinator.flushRemoteIfNeeded(false, uploadRemote, ensureLocalFlushed)
    },
    async afterDecisionProgress(session: SessionTouchState) {
      coordinator.noteSession(session)
      await coordinator.flushSessionIfNeeded(false, async (state) => {
        await ensureLocalFlushed()
        await writeSession(state)
      })
    },
    async finalize(manifest: SyncManifest, session?: SessionTouchState) {
      if (session) coordinator.noteSession(session)
      coordinator.noteManifest(manifest)
      await coordinator.finalizeAll(saveLocal, saveSnapshot, uploadRemote, async (state) => {
        await ensureLocalFlushed()
        await writeSession(state)
      })
    }
  }
}
