import { ipcMain, dialog, BrowserWindow } from 'electron'
import { SessionRepository, AssistantRepository, MessageRepository, connectionManager } from '@baishou/database'
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository'
import { 
  SessionFileService,
  SessionSyncService,
  SessionManagerService,
  AssistantFileService,
  AssistantManagerService
} from '@baishou/core'
import { pathService } from './vault.ipc'
import { settingsManager } from './settings.ipc'
import { AIProviderConfig, GlobalModelsConfig } from '@baishou/shared'

// @ts-ignore
import { AgentSessionService } from '@baishou/ai/src/agent/agent-session.service'
// @ts-ignore
import { ToolRegistry } from '@baishou/ai/src/tools/tool-registry'
// @ts-ignore
import { AIProviderRegistry } from '@baishou/ai/src/providers/provider.registry'

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

const toolRegistry = new ToolRegistry();
const agentService = new AgentSessionService();

let globalAbortController: AbortController | null = null;

async function getActiveProvider() {
  const providers = await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
  
  const providerId = globalModels?.globalDialogueProviderId;
  const config = providers.find((p: AIProviderConfig) => p.id === providerId);
  
  const actualConfig = config || providers.find((p: AIProviderConfig) => p.isActive || p.isEnabled);
  if (!actualConfig) throw new Error('No active provider configured');
  
  const registry = AIProviderRegistry.getInstance();
  if (!registry.hasProvider(actualConfig.id)) {
      registry.registerProvider((registry as any).createProviderInstance(actualConfig));
  }
  const provider = registry.getProvider(actualConfig.id);
  if (!provider) throw new Error(`Failed to instantiate provider ${actualConfig.id}`);
  return provider;
}

export function registerAgentIPC() {
  
  // ==========================================
  // API: Assistants
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
  // API: Sessions 
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
  
  ipcMain.handle('agent:update-session-title', async (_, sessionId: string, title: string) => {
    const { realSessionRepo } = getAgentManagers();
    await realSessionRepo.updateSessionTitle(sessionId, title);
    return true;
  });
  
  ipcMain.handle('agent:export-session', async (_, sessionId: string) => {
    const { realSessionRepo } = getAgentManagers();
    const messages = await realSessionRepo.getMessagesBySession(sessionId, 999);
    
    // 格式化为 Markdown
    const lines: string[] = [];
    for (const msg of messages.reverse()) {
      const role = msg.role === 'user' ? '**用户**' : '**AI**';
      lines.push(`### ${role}\n`);
      const contentParts = msg.parts ? msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.data?.text || p.data).join('\n') : '';
      lines.push(contentParts);
      lines.push('');
    }
    return lines.join('\n');
  });
  
  ipcMain.handle('agent:get-token-usage', async (_, sessionId: string) => {
    const { realSessionRepo } = getAgentManagers();
    const session = await realSessionRepo.getSessionById(sessionId);
    return {
      inputTokens: session?.totalInputTokens || 0,
      outputTokens: session?.totalOutputTokens || 0,
      totalCostMicros: session?.totalCostMicros || 0
    };
  });
  
  ipcMain.handle('agent:list-sessions-by-assistant', async (_, assistantId: string) => {
    const { sessionManager } = getAgentManagers();
    const all = await sessionManager.findAllSessions();
    return all.filter(s => s.assistantId === assistantId);
  });

  // ==========================================
  // API: Chat (Stream)
  // ==========================================
  ipcMain.handle('agent:get-messages', async (_, sessionId: string) => {
    const { realMessageRepo } = getAgentManagers();
    return await realMessageRepo.findBySessionId(sessionId, 50);
  });
  
  ipcMain.handle('agent:delete-message', async (_, sessionId: string, messageId: string) => {
    const { realSessionRepo } = getAgentManagers();
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId);
    return true;
  });

  ipcMain.handle('agent:chat', async (event, args: { sessionId: string; text: string }) => {
    try {
      const { realSessionRepo, realSnapshotRepo, sessionManager } = getAgentManagers();
      const provider = await getActiveProvider();
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
      
      globalAbortController = new AbortController();
      
      await agentService.streamChat({
        sessionId: args.sessionId,
        userText: args.text,
        provider: provider,
        modelId: globalModels?.globalDialogueModelId || 'deepseek-chat',
        toolRegistry: toolRegistry,
        sessionRepo: realSessionRepo as any,
        snapshotRepo: realSnapshotRepo as any,
        systemPrompt: "You are BaiShou-Next, a genius local assistant. Follow the tools when applicable.",
        abortSignal: globalAbortController.signal
      }, {
        onTextDelta: (chunk) => event.sender.send('agent:stream-chunk', chunk),
        onReasoningDelta: (chunk) => event.sender.send('agent:reasoning-chunk', chunk),
        onToolCallStart: (name, argsObj) => event.sender.send('agent:tool-start', { name, args: argsObj }),
        onToolCallResult: (name, result) => event.sender.send('agent:tool-result', { name, result }),
        onError: (err) => event.sender.send('agent:stream-finish', { error: err.message }),
        onFinish: () => event.sender.send('agent:stream-finish', { success: true })
      });

      try {
         await sessionManager.flushSessionToDisk(args.sessionId);
      } catch (e) {
         console.error('Agent IPC persistence SSOT Error', e);
      }
      return true
    } catch (error: any) {
      if (error.name === 'AbortError') {
         event.sender.send('agent:stream-finish', { success: true });
         return true;
      }
      console.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', { error: error.message || 'Stream Error' })
      return false
    } finally {
      globalAbortController = null;
    }
  });
  
  ipcMain.handle('agent:regenerate', async (event, sessionId: string) => {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers();
    
    // 1. 找到最后一条 assistant 消息并删除
    const messages = await realSessionRepo.getMessagesBySession(sessionId, 2);
    const lastAi = messages.find((m: any) => m.role === 'assistant');
    if (lastAi) {
      await realSessionRepo.deleteMessage(sessionId, lastAi.id);
    }
    
    // 2. 获取最后的 user 消息
    const userMessages = await realSessionRepo.getMessagesBySession(sessionId, 1);
    const lastUser = userMessages.find((m: any) => m.role === 'user');
    if (!lastUser) return false;
    
    // 3. 重新发起
    const provider = await getActiveProvider();
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
    globalAbortController = new AbortController();
    
    try {
        await agentService.streamChat({
          sessionId,
          userText: (lastUser.parts && lastUser.parts.length > 0) ? lastUser.parts.filter((p:any) => p.type === 'text').map((p:any) => p.data?.text || p.data).join('\n') : '',
          provider,
          modelId: globalModels?.globalDialogueModelId || 'deepseek-chat',
          toolRegistry,
          sessionRepo: realSessionRepo as any,
          snapshotRepo: realSnapshotRepo as any,
          abortSignal: globalAbortController.signal
        }, {
          onTextDelta: (chunk) => event.sender.send('agent:stream-chunk', chunk),
          onToolCallStart: (name, args) => event.sender.send('agent:tool-start', { name, args }),
          onToolCallResult: (name, result) => event.sender.send('agent:tool-result', { name, result }),
          onError: (err) => event.sender.send('agent:stream-finish', { error: err.message }),
          onFinish: () => event.sender.send('agent:stream-finish', { success: true })
        });
        return true;
    } catch (e: any) {
        if (e.name === 'AbortError') {
             event.sender.send('agent:stream-finish', { success: true });
             return true;
        }
        event.sender.send('agent:stream-finish', { error: e.message });
        return false;
    } finally {
        globalAbortController = null;
    }
  });

  ipcMain.handle('agent:stop-stream', async () => {
    if (globalAbortController) {
      globalAbortController.abort();
      globalAbortController = null;
    }
    return true;
  });

  ipcMain.handle('agent:edit-message', async (event, sessionId: string, messageId: string, newText: string) => {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers();
    
    // 1. 删除该消息之后的所有消息
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId);
    
    // 2. 用新文本重新发送
    const provider = await getActiveProvider();
    const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
    globalAbortController = new AbortController();
    
    try {
        await agentService.streamChat({
          sessionId,
          userText: newText,
          provider,
          modelId: globalModels?.globalDialogueModelId || 'deepseek-chat',
          toolRegistry,
          sessionRepo: realSessionRepo as any,
          snapshotRepo: realSnapshotRepo as any,
          abortSignal: globalAbortController.signal
        }, {
          onTextDelta: (chunk) => event.sender.send('agent:stream-chunk', chunk),
          onFinish: () => event.sender.send('agent:stream-finish', { success: true }),
          onError: (err) => event.sender.send('agent:stream-finish', { error: err.message }),
        });
        return true;
    } catch (e: any) {
        if (e.name === 'AbortError') {
             event.sender.send('agent:stream-finish', { success: true });
             return true;
        }
        event.sender.send('agent:stream-finish', { error: e.message });
        return false;
    } finally {
        globalAbortController = null;
    }
  });

  // Phase 10: File Picker API
  ipcMain.handle('system:pick-files', async (event, options?: Electron.OpenDialogOptions) => {
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
    return await settingsManager.get<AIProviderConfig[]>('ai_providers') || [];
  });
}
