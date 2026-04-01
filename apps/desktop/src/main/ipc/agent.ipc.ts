import { ipcMain, dialog, BrowserWindow } from 'electron'
import { join } from 'path';
import { SessionRepository, AssistantRepository, MessageRepository, connectionManager } from '@baishou/database'
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository'
import { 
  AgentService, 
  SessionFileService,
  SessionSyncService,
  SessionManagerService,
  AssistantFileService,
  AssistantManagerService
} from '@baishou/core'
import { pathService } from './vault.ipc'

// @ts-ignore
import { AgentSessionService } from '@baishou/ai/src/agent/agent-session.service'
// @ts-ignore
import { ToolRegistry } from '@baishou/ai/src/tools/tool-registry'

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
  const realSnapshotRepo = new SnapshotRepository(db);

  return { sessionManager, assistantManager, realMessageRepo, realSessionRepo, realSnapshotRepo };
}

// 为了这第一枪实弹测试，我们使用全局预埋的指挥官提供的深求 Token (深求默认支持 OpenAI 协议)
const deepseekTarget = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: 'sk-435ddce8f94d4b01abc92b5cbf1e57be'
});

const mockProviderRegistry = {
  config: { id: 'deepseek_global' },
  getLanguageModel: (modelId: string) => deepseekTarget.chat(modelId),
  getEmbeddingModel: () => undefined // 等待未来 Gamma 设置面板打通向量选择
} as any;

const toolRegistry = new ToolRegistry();
const agentService = new AgentSessionService();

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
  // API: Chat (The Real Stream Pipeline)
  // ==========================================
  ipcMain.handle('agent:get-messages', async (_, sessionId: string) => {
    const { realMessageRepo } = getAgentManagers();
    return await realMessageRepo.findBySessionId(sessionId, 50);
  });

    ipcMain.handle('agent:chat', async (event, args: { sessionId: string; text: string }) => {
    try {
      const { realSessionRepo, realSnapshotRepo, sessionManager } = getAgentManagers();
      // 开启纯血无Mock的多模态隧道
      await agentService.streamChat({
        sessionId: args.sessionId,
        userText: args.text,
        provider: mockProviderRegistry,
        modelId: 'deepseek-chat', // 对齐模型的官方代号
        toolRegistry: toolRegistry,
        sessionRepo: realSessionRepo,
        snapshotRepo: realSnapshotRepo,
        systemPrompt: "You are BaiShou-Next, a genius local assistant. Follow the tools when applicable."
      }, {
        onTextDelta: (chunk) => event.sender.send('agent:stream-chunk', chunk),
        onReasoningDelta: (chunk) => event.sender.send('agent:reasoning-chunk', chunk),
        onToolCallStart: (name, argsObj) => event.sender.send('agent:tool-start', { name, args: argsObj }),
        onToolCallResult: (name, result) => event.sender.send('agent:tool-result', { name, result }),
        onError: (err) => event.sender.send('agent:stream-finish', { error: err.message }),
        onFinish: () => event.sender.send('agent:stream-finish', { success: true })
      });

      // Phase 8: 发起一次整个气泡 JSON 到 Vault/Sessions 的快照归档持久化
      try {
         await sessionManager.flushSessionToDisk(args.sessionId);
      } catch (e) {
         console.error('Agent IPC persistence SSOT Error', e);
      }
      return true
    } catch (error: any) {
      console.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', { error: error.message || 'Stream Error' })
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
