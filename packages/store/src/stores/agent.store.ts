import { createStore } from '../create-store';

export interface MessageId {
  id: string;
}

export interface AgentMessage extends MessageId {
  role: 'user' | 'assistant' | 'system' | 'data';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AgentState {
  messages: AgentMessage[];
  isLoading: boolean;
  toolCalls: Record<string, any>;
}

export interface AgentActions {
  addMessage: (message: AgentMessage) => void;
  updateMessage: (id: string, partial: Partial<AgentMessage>) => void;
  setLoading: (loading: boolean) => void;
  addToolCall: (id: string, toolCallName: string, args: any) => void;
  clearSession: () => void;
}

export const useAgentStore = createStore<AgentState & AgentActions>('AgentStore', (set) => ({
  messages: [],
  isLoading: false,
  toolCalls: {},

  addMessage: (message) => 
    set((state: AgentState) => ({ messages: [...state.messages, message] })),

  updateMessage: (id, partial) => 
    set((state: AgentState) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...partial } : m
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  addToolCall: (id, toolCallName, args) =>
    set((state: AgentState) => ({
      toolCalls: {
        ...state.toolCalls,
        [id]: { name: toolCallName, args },
      },
    })),

  clearSession: () => set({ messages: [], toolCalls: {}, isLoading: false }),
}));
