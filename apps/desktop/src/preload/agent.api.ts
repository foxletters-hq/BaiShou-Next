import { ipcRenderer } from 'electron'

export const agentApi = {
  agentChat: (params: { sessionId: string; text: string }) =>
    ipcRenderer.invoke('agent:chat', params),
  saveUserMessage: (params: { sessionId: string; text: string; attachments?: any[] }) =>
    ipcRenderer.invoke('agent:save-user-message', params),
  getMessages: (sessionId: string) => ipcRenderer.invoke('agent:get-messages', sessionId),

  onAgentStreamChunk: (callback: (chunk: string) => void) => {
    ipcRenderer.on('agent:stream-chunk', (_event, chunk) => callback(chunk))
  },
  onAgentStreamFinish: (callback: (error?: string) => void) => {
    ipcRenderer.on('agent:stream-finish', (_event, error) => callback(error))
  },
  removeAgentListeners: () => {
    ipcRenderer.removeAllListeners('agent:stream-chunk')
    ipcRenderer.removeAllListeners('agent:stream-finish')
  },

  getProviders: () => ipcRenderer.invoke('agent:get-providers'),

  // TTS
  tts: {
    synthesize: (text: string, providerId?: string, modelId?: string) =>
      ipcRenderer.invoke('agent:tts-synthesize', text, providerId, modelId)
  },

  // Sessions
  getSessions: () => ipcRenderer.invoke('agent:get-sessions'),
  deleteSessions: (ids: string[]) => ipcRenderer.invoke('agent:delete-sessions', ids),
  pinSession: (id: string, isPinned: boolean) =>
    ipcRenderer.invoke('agent:pin-session', id, isPinned),

  // Assistants
  getAssistants: () => ipcRenderer.invoke('agent:get-assistants'),
  createAssistant: (input: any) => ipcRenderer.invoke('agent:create-assistant', input),
  updateAssistant: (id: string, input: any) =>
    ipcRenderer.invoke('agent:update-assistant', id, input),
  deleteAssistant: (id: string) => ipcRenderer.invoke('agent:delete-assistant', id),

  // RAG System
  rag: {
    getStats: () => ipcRenderer.invoke('rag:get-stats'),
    detectDimension: () => ipcRenderer.invoke('rag:detect-dimension'),
    clearDimension: () => ipcRenderer.invoke('rag:clear-dimension'),
    triggerBatchEmbed: () => ipcRenderer.invoke('rag:trigger-batch-embed'),
    addManualMemory: (text: string) => ipcRenderer.invoke('rag:add-manual-memory', text),
    clearAll: () => ipcRenderer.invoke('rag:clear-all'),
    triggerMigration: () => ipcRenderer.invoke('rag:trigger-migration'),
    queryEntries: (params: any) => ipcRenderer.invoke('rag:query-entries', params),
    deleteEntry: (id: string) => ipcRenderer.invoke('rag:delete-entry', id),
    editEntry: (params: { embeddingId: string; newText: string }) =>
      ipcRenderer.invoke('rag:edit-entry', params),
    hasPendingMigration: () => ipcRenderer.invoke('rag:has-pending-migration'),
    hasModelMismatch: () => ipcRenderer.invoke('rag:has-model-mismatch'),
    onRagProgress: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state)
      ipcRenderer.on('agent:rag-progress', handler)
      return () => ipcRenderer.off('agent:rag-progress', handler)
    },
    buildSharedContext: (lookbackMonths: number, locale?: string) =>
      ipcRenderer.invoke('summary:buildSharedContext', lookbackMonths, locale)
  }
}
