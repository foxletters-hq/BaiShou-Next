import { create } from 'zustand'
import type { IncrementalSyncPlanPreview, SyncProgressEvent } from '@baishou/shared'

export type SyncStatus = 'idle' | 'connecting' | 'planning' | 'syncing' | 'success' | 'error'

export interface SyncState {
  status: SyncStatus
  message: string
  syncResult: any | null
  progress: SyncProgressEvent | null
  planPreview: IncrementalSyncPlanPreview | null
  planDialogOpen: boolean

  setStatus: (status: SyncStatus) => void
  setMessage: (message: string) => void
  setSyncResult: (result: any | null) => void
  setProgress: (progress: SyncProgressEvent | null) => void
  setPlanPreview: (preview: IncrementalSyncPlanPreview | null) => void
  setPlanDialogOpen: (open: boolean) => void
  clearPlanPreview: () => void
  reset: () => void
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  message: '',
  syncResult: null,
  progress: null,
  planPreview: null,
  planDialogOpen: false,

  setStatus: (status) => set({ status }),
  setMessage: (message) => set({ message }),
  setSyncResult: (syncResult) => set({ syncResult }),
  setProgress: (progress) => set({ progress }),
  setPlanPreview: (planPreview) => set({ planPreview }),
  setPlanDialogOpen: (planDialogOpen) => set({ planDialogOpen }),
  clearPlanPreview: () => set({ planPreview: null, planDialogOpen: false }),
  reset: () =>
    set({
      status: 'idle',
      message: '',
      syncResult: null,
      progress: null,
      planPreview: null,
      planDialogOpen: false
    })
}))
