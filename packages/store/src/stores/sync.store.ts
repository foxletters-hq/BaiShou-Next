import { create } from 'zustand';
import type { SyncProgressEvent } from '@baishou/shared';

export interface SyncState {
  status: 'idle' | 'connecting' | 'syncing' | 'success' | 'error';
  message: string;
  syncResult: any | null;
  progress: SyncProgressEvent | null;

  setStatus: (status: 'idle' | 'connecting' | 'syncing' | 'success' | 'error') => void;
  setMessage: (message: string) => void;
  setSyncResult: (result: any | null) => void;
  setProgress: (progress: SyncProgressEvent | null) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  message: '',
  syncResult: null,
  progress: null,

  setStatus: (status) => set({ status }),
  setMessage: (message) => set({ message }),
  setSyncResult: (syncResult) => set({ syncResult }),
  setProgress: (progress) => set({ progress }),
  reset: () => set({ status: 'idle', message: '', syncResult: null, progress: null }),
}));
