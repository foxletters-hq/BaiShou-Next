import { createStore } from '../create-store';

export interface Assistant {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  avatarPath?: string;
  systemPrompt?: string;
  isDefault: boolean;
  contextWindow: number;
  providerId: string;
  modelId: string;
  compressTokenThreshold: number;
  compressKeepTurns: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssistantState {
  assistants: Assistant[];
  isLoading: boolean;
  error: string | null;
}

export interface AssistantActions {
  fetchAssistants: () => Promise<void>;
  createAssistant: (input: Partial<Assistant> & { id: string; name: string; providerId: string; modelId: string }) => Promise<void>;
  updateAssistant: (id: string, input: Partial<Omit<Assistant, 'id'>>) => Promise<void>;
  deleteAssistant: (id: string) => Promise<void>;
}

export const useAssistantStore = createStore<AssistantState & AssistantActions>(
  'AssistantStore',
  (set) => ({
    assistants: [],
    isLoading: false,
    error: null,

    fetchAssistants: async () => {
      set({ isLoading: true, error: null });
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          const data = await (window as any).api.getAssistants();
          set({ assistants: data, isLoading: false });
        } else {
          // Fallback context - dummy data for UI testing if IPC breaks
          set({ assistants: [], isLoading: false });
        }
      } catch (err: any) {
        set({ error: err.message, isLoading: false });
      }
    },

    createAssistant: async (input) => {
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          await (window as any).api.createAssistant(input);
          // Refetch to ensure state matches DB
          const data = await (window as any).api.getAssistants();
          set({ assistants: data });
        }
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    updateAssistant: async (id, input) => {
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          await (window as any).api.updateAssistant(id, input);
          const data = await (window as any).api.getAssistants();
          set({ assistants: data });
        }
      } catch (err: any) {
        set({ error: err.message });
      }
    },

    deleteAssistant: async (id) => {
      try {
        if (typeof window !== 'undefined' && (window as any).api) {
          await (window as any).api.deleteAssistant(id);
          const data = await (window as any).api.getAssistants();
          set({ assistants: data });
        }
      } catch (err: any) {
        set({ error: err.message });
      }
    }
  })
);
