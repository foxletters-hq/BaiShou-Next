import { createStore } from '../create-store';

export interface Session {
  id: string;
  vaultName: string;
  providerId: string;
  modelId: string;
  title: string | null;
  assistantId: string | null;
  systemPrompt: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionListState {
  sessions: Session[];
  isLoading: boolean;
  error: string | null;
}

export interface SessionListActions {
  fetchSessions: () => Promise<void>;
  deleteSessions: (ids: string[]) => Promise<void>;
  pinSession: (id: string, isPinned: boolean) => Promise<void>;
}

export const useSessionStore = createStore<SessionListState & SessionListActions>(
  'SessionStore',
  (set) => ({
    sessions: [],
    isLoading: false,
    error: null,

    fetchSessions: async () => {
      set({ isLoading: true, error: null });
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          const data = await (window as any).api.getSessions();
          set({ sessions: data, isLoading: false });
        } else {
          set({ sessions: [], isLoading: false });
        }
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    deleteSessions: async (ids) => {
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          await (window as any).api.deleteSessions(ids);
          const data = await (window as any).api.getSessions();
          set({ sessions: data });
        }
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    pinSession: async (id, isPinned) => {
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          await (window as any).api.pinSession(id, isPinned);
          const data = await (window as any).api.getSessions();
          set({ sessions: data });
        }
      } catch (err: any) {
        set({ error: err.message });
      }
    }
  })
);
