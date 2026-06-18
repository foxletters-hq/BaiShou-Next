import { createStore } from '../create-store'

export interface MessageId {
  id: string
}

export interface AgentMessagePart {
  id?: string
  type: string
  data?: Record<string, unknown> | string
}

export interface AgentMessage extends MessageId {
  role: 'user' | 'assistant' | 'system' | 'data'
  content: string
  timestamp: Date
  metadata?: Record<string, any>
  attachments?: unknown[]
  parts?: AgentMessagePart[]
}

export interface AgentState {
  messages: AgentMessage[]
  isLoading: boolean
  toolCalls: Record<string, any>
  searchMode: boolean
  /** 当前活跃会话（跨 Tab 卸载保持） */
  currentSessionId: string | null
}

export interface AgentActions {
  addMessage: (message: AgentMessage) => void
  setMessages: (messages: AgentMessage[]) => void
  updateMessage: (id: string, partial: Partial<AgentMessage>) => void
  setLoading: (loading: boolean) => void
  addToolCall: (id: string, toolCallName: string, args: any) => void
  clearSession: () => void
  setCurrentSessionId: (sessionId: string | null) => void
  initIpcListeners: () => void
  sendMessage: (sessionId: string, text: string) => void
  loadMessages: (sessionId: string) => Promise<void>
  setSearchMode: (enabled: boolean) => void
  toggleSearchMode: () => void
}

export const useAgentStore = createStore<AgentState & AgentActions>(
  'AgentStore',
  (set, get: any) => ({
    messages: [],
    isLoading: false,
    toolCalls: {},
    searchMode: false,
    currentSessionId: null,

    addMessage: (message) =>
      set((state: AgentState) => {
        const existingIndex = state.messages.findIndex((m) => m.id === message.id)
        if (existingIndex >= 0) {
          const next = [...state.messages]
          next[existingIndex] = { ...next[existingIndex]!, ...message }
          return { messages: next }
        }
        return { messages: [...state.messages, message] }
      }),

    setMessages: (messages) => set({ messages }),

    updateMessage: (id, partial) =>
      set((state: AgentState) => ({
        messages: state.messages.map((m) => (m.id === id ? { ...m, ...partial } : m))
      })),

    setLoading: (isLoading) => set({ isLoading }),

    addToolCall: (id, toolCallName, args) =>
      set((state: AgentState) => ({
        toolCalls: {
          ...state.toolCalls,
          [id]: { name: toolCallName, args }
        }
      })),

    clearSession: () => set({ messages: [], toolCalls: {}, isLoading: false }),

    setCurrentSessionId: (sessionId) => set({ currentSessionId: sessionId }),

    setSearchMode: (enabled: boolean) => set({ searchMode: enabled }),

    toggleSearchMode: () => set((state: AgentState) => ({ searchMode: !state.searchMode })),

    loadMessages: async (sessionId: string) => {
      if (typeof window !== 'undefined' && (window as any).api) {
        const msgs = await (window as any).api.getMessages?.(sessionId)
        if (msgs) {
          set({
            messages: msgs.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: '', // Need to hydrate parts if exist, default to empty for now
              timestamp: new Date(m.createdAt)
            })),
            isLoading: false
          })
        }
      }
    },

    initIpcListeners: () => {
      // Check if electron bridge exists
      if (typeof window !== 'undefined' && (window as any).api) {
        const api = (window as any).api

        api.removeAgentListeners?.()

        api.onAgentStreamChunk?.((chunk: string) => {
          set((state: AgentState) => {
            const msgs = [...state.messages]
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1]
              if (last && last.role === 'assistant') {
                last.content += chunk
                return { messages: msgs }
              }
            }
            return state
          })
        })

        api.onAgentStreamFinish?.((error?: string) => {
          set({ isLoading: false })
          if (error) {
            console.error('Agent chat stream hit an error:', error)
          }
        })
      }
    },

    sendMessage: (sessionId: string, text: string) => {
      const { addMessage, setLoading } = get()
      // Add User Message immediately for fast UI feedback
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: new Date()
      })
      setLoading(true)

      // Initial Empty Assistant Message for streaming
      const assistantMsgId = (Date.now() + 1).toString()
      addMessage({
        id: assistantMsgId,
        role: 'assistant',
        content: '', // Will stream
        timestamp: new Date()
      })

      // Send through IPC if available
      if (typeof window !== 'undefined' && (window as any).api) {
        ;(window as any).api.agentChat?.({ sessionId, text })
      } else {
        // Fallback for Web/RN (dummy timeout)
        setTimeout(() => {
          get().updateMessage(assistantMsgId, {
            content: 'Mock response in Web/RN (IPC not found)'
          })
          setLoading(false)
        }, 1000)
      }
    }
  })
)
