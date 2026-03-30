import { ipcMain, dialog, BrowserWindow } from 'electron'
import { AgentService, MockAgentSessionRepository, MockAgentMessageRepository } from '@baishou/core'

// Define dummy provider logic directly here temporarily just to pass registry 
class DummyModel {
  constructor(public id: string) {}
}

const mockProviderRegistry = {
  getProvider: () => ({
    getModel: (modelId: string) => new DummyModel(modelId)
  })
} as any

const mockToolRegistry = {
  toVercelTools: () => ({})
} as any

const sessionRepo = new MockAgentSessionRepository()
const messageRepo = new MockAgentMessageRepository()
const agentService = new AgentService(
  sessionRepo,
  messageRepo,
  mockProviderRegistry,
  mockToolRegistry
)

// Ensure at least one dummy session exists for streamChat to find
sessionRepo.sessions.push({
  id: 'ipc-session',
  vaultName: 'ipc-vault',
  providerId: 'ipc-provider',
  modelId: 'ipc-model',
  assistantId: 'ipc-assistant',
  systemPrompt: 'You are a mock IPC assistant.',
  totalInputTokens: 0,
  totalOutputTokens: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
})

export function registerAgentIPC() {
  ipcMain.handle('agent:chat', async (event, text: string) => {
    try {
      const result = await agentService.streamChat({
        sessionId: 'ipc-session',
        userMessage: text,
      })

      // Iterate async over the Vercel AI SDK textStream
      for await (const chunk of result.textStream) {
        // Send chunk to renderer who made the IPC call
        event.sender.send('agent:stream-chunk', chunk)
      }

      event.sender.send('agent:stream-finish')
      return true
    } catch (error: any) {
      console.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', error.message || 'Stream Error')
      return false
    }
  })

  // Phase 10: File Picker API
  ipcMain.handle('system:pick-files', async (event, options?: Electron.OpenDialogOptions) => {
    // Get the window associated with the sender
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return []

    const defaultOptions: Electron.OpenDialogOptions = {
      title: 'Select Input Attachments',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Documents & Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'pdf', 'txt', 'md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }

    try {
      const result = await dialog.showOpenDialog(window, { ...defaultOptions, ...options })
      if (result.canceled) return []
      
      // We can map these file paths to a simpler object format expected by the frontend
      return result.filePaths.map(filePath => {
        const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(filePath)
        const isPdf = /\.pdf$/i.test(filePath)
        const fileName = filePath.split(/[/\\]/).pop() || 'Unknown'
        
        return {
          id: Math.random().toString(36).substring(7),
          fileName,
          filePath,
          isImage,
          isPdf,
        }
      })
    } catch (err) {
      console.error('File Picker Error:', err)
      return []
    }
  })

  // Phase 10: Provider Discovery API
  ipcMain.handle('agent:get-providers', async () => {
    // Eventually this will call real DB or configurations for providers.
    // For now we simulate the payload bridge to remove static imports in UI.
    return [
      {
        id: 'openai_1',
        name: 'OpenAI (Global)',
        type: 'openai',
        models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        enabledModels: ['gpt-4o', 'gpt-3.5-turbo'],
        isActive: true,
      },
      {
        id: 'anthropic_1',
        name: 'Anthropic Claude',
        type: 'anthropic',
        models: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'],
        enabledModels: ['claude-3-5-sonnet-20240620'],
        isActive: true,
      }
    ]
  })
}
