import { ipcMain, dialog, BrowserWindow } from 'electron'
import { 
  AgentService, 
  SessionFileService,
  SessionSyncService,
  SessionManagerService,
  AssistantFileService,
  AssistantManagerService
} from '@baishou/core'
import { SessionRepository, AssistantRepository, MessageRepository } from '@baishou/database'
import { connectionManager } from '@baishou/database';
import { pathService } from './vault.ipc'

// 动态工厂：确保每一次响应 IPC 时都锁定在用户当前所切环境的 Database 句柄上
export function getAgentManagers() {
  const db = connectionManager.getDb();
  
  const realSessionRepo = new SessionRepository(db);
  const sessionFileService = new SessionFileService(pathService);
  const sessionSyncService = new SessionSyncService(realSessionRepo, sessionFileService);
  const sessionManager = new SessionManagerService(realSessionRepo, sessionFileService, sessionSyncService);

  const realAssistantRepo = new AssistantRepository(db);
  const assistantFileService = new AssistantFileService(pathService);
  const assistantManager = new AssistantManagerService(realAssistantRepo, assistantFileService);

  const realMessageRepo = new MessageRepository(db);

  return { sessionManager, assistantManager, realMessageRepo, realSessionRepo };
}

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

export function registerAgentIPC() {
  
  // ==========================================
  // API: Assistants (SSOT pipeline connected)
  // ==========================================
  ipcMain.handle('agent:get-assistants', async () => {
    const { assistantManager } = getAgentManagers();
    return await assistantManager.findAll();
  });

  ipcMain.handle('agent:create-assistant', async (_, input) => {
    const { assistantManager } = getAgentManagers();
    await assistantManager.create(input);
  });

  ipcMain.handle('agent:update-assistant', async (_, id, input) => {
    const { assistantManager } = getAgentManagers();
    await assistantManager.update(id, input);
  });

  ipcMain.handle('agent:delete-assistant', async (_, id) => {
    const { assistantManager } = getAgentManagers();
    await assistantManager.delete(id);
  });

  // ==========================================
  // API: Sessions (Refactored to SSOT Sync pipeline)
  // ==========================================
  ipcMain.handle('agent:get-sessions', async () => {
    const { sessionManager } = getAgentManagers();
    return await sessionManager.findAllSessions();
  });

  ipcMain.handle('agent:delete-sessions', async (_, ids: string[]) => {
    const { sessionManager } = getAgentManagers();
    await sessionManager.deleteSessions(ids);
  });

  ipcMain.handle('agent:pin-session', async (_, id: string, isPinned: boolean) => {
    const { sessionManager } = getAgentManagers();
    await sessionManager.togglePin(id, isPinned);
  });

  // ==========================================
  // API: Chat (Legacy mocked stream chat)
  // ==========================================
  ipcMain.handle('agent:get-messages', async (_, sessionId: string) => {
    const { realMessageRepo } = getAgentManagers();
    return await realMessageRepo.findBySessionId(sessionId, 50);
  });

    ipcMain.handle('agent:chat', async (event, args: { sessionId: string; text: string }) => {
    try {
      const { realSessionRepo, realMessageRepo, sessionManager } = getAgentManagers();
      const agentService = new AgentService(realSessionRepo as any, realMessageRepo as any, mockProviderRegistry, mockToolRegistry);

      const result = await agentService.streamChat({
        sessionId: args.sessionId,
        userMessage: args.text,
      })

      for await (const chunk of result.textStream) {
        event.sender.send('agent:stream-chunk', chunk)
      }

      event.sender.send('agent:stream-finish')
      
      // Phase 8: 当流式会话走完并把消息插入 db 后，我们主动在系统后台发起一次整个气泡 JSON 到 Vault/Sessions 的快照归档持久化
      try {
         await sessionManager.flushSessionToDisk(args.sessionId);
      } catch (e) {
         console.error('Agent IPC persistence SSOT Error', e);
      }

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
