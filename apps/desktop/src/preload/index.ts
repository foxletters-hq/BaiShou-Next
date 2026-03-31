import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
export const api = {
  agentChat: (params: { sessionId: string; text: string }) => ipcRenderer.invoke('agent:chat', params),
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
  
  // Phase 10 Extracted System Access
  pickFiles: () => ipcRenderer.invoke('system:pick-files'),
  getProviders: () => ipcRenderer.invoke('agent:get-providers'),

  // Data Routing API (Phase 11: Data Wiring)
  getSessions: () => ipcRenderer.invoke('agent:get-sessions'),
  deleteSessions: (ids: string[]) => ipcRenderer.invoke('agent:delete-sessions', ids),
  pinSession: (id: string, isPinned: boolean) => ipcRenderer.invoke('agent:pin-session', id, isPinned),

  getAssistants: () => ipcRenderer.invoke('agent:get-assistants'),
  createAssistant: (input: any) => ipcRenderer.invoke('agent:create-assistant', input),
  updateAssistant: (id: string, input: any) => ipcRenderer.invoke('agent:update-assistant', id, input),
  deleteAssistant: (id: string) => ipcRenderer.invoke('agent:delete-assistant', id),
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
