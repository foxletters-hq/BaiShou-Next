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
  initIpcListeners: () => void;
  sendMessage: (sessionId: string, text: string) => void;
  loadMessages: (sessionId: string) => Promise<void>;
}

export const useAgentStore = createStore<AgentState & AgentActions>('AgentStore', (set, get: any) => ({
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

  loadMessages: async (sessionId: string) => {
    if (typeof window !== 'undefined' && (window as any).api) {
      const msgs = await (window as any).api.getMessages?.(sessionId);
      if (msgs) {
        set({
          messages: msgs.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: '', // Need to hydrate parts if exist, default to empty for now
            timestamp: new Date(m.createdAt)
          })),
          isLoading: false
        });
      }
    }
  },

  initIpcListeners: () => {
    // Check if electron bridge exists
    if (typeof window !== 'undefined' && (window as any).api) {
      const api = (window as any).api;
      
      api.removeAgentListeners?.();
      
      api.onAgentStreamChunk?.((chunk: string) => {
        set((state: AgentState) => {
          const msgs = [...state.messages];
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1];
            if (last && last.role === 'assistant') {
              last.content += chunk;
              return { messages: msgs };
            }
          }
          return state;
        });
      });
      
      api.onAgentStreamFinish?.((error?: string) => {
        set({ isLoading: false });
        if (error) {
          console.error('Agent chat stream hit an error:', error);
        }
      });
    }
  },

  sendMessage: (sessionId: string, text: string) => {
    const { addMessage, setLoading } = get();
    // Add User Message immediately for fast UI feedback
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    });
    setLoading(true);

    // Initial Empty Assistant Message for streaming
    const assistantMsgId = (Date.now() + 1).toString();
    addMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '', // Will stream
      timestamp: new Date()
    });

    // Send through IPC if available
    if (typeof window !== 'undefined' && (window as any).api) {
      (window as any).api.agentChat?.({ sessionId, text });
    } else {
      // Fallback for Web/RN (dummy timeout)
      setTimeout(() => {
        get().updateMessage(assistantMsgId, { content: 'Mock response in Web/RN (IPC not found)' });
        setLoading(false);
      }, 1000);
    }
  }
}));
