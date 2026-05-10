import { ipcMain } from 'electron'
import * as crypto from 'crypto'
import { getAgentManagers } from './agent-helpers'
import { pathService } from './vault.ipc'
import { settingsManager } from './settings.ipc'
import { GlobalModelsConfig, logger } from '@baishou/shared'

export function registerSessionIPC() {
  // ==========================================
  // API: Sessions 
  // ==========================================
  ipcMain.handle('agent:get-sessions', async (_, limit: number = 20, offset: number = 0, assistantId?: string) => {
    const { sessionManager } = getAgentManagers();
    return await sessionManager.findAllSessions(limit, offset, assistantId);
  });

  ipcMain.handle('agent:get-session', async (_, sessionId: string) => {
    const { realSessionRepo } = getAgentManagers();
    return await realSessionRepo.getSessionById(sessionId);
  });

  ipcMain.handle('agent:create-session', async (_, { assistantId, title }) => {
    const { sessionManager, assistantManager } = getAgentManagers();
    
    // Fallbacks for required fields
    let vaultName = 'default';
    try {
        const activeVaultPath = await pathService.getActiveVaultPath();
        if (activeVaultPath) {
           vaultName = activeVaultPath.split(/[/\\]/).pop() || 'default';
        }
    } catch(e) {}

    let providerId = 'default';
    let modelId = 'default';

    if (assistantId) {
       const assistant = await assistantManager.findById(assistantId);
       if (assistant) {
          providerId = assistant.providerId || 'default';
          modelId = assistant.modelId || 'default';
       }
    }

    if (providerId === 'default' || modelId === 'default') {
       const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');
       if (providerId === 'default') providerId = globalModels?.globalDialogueProviderId || 'default';
       if (modelId === 'default') modelId = globalModels?.globalDialogueModelId || 'default';
    }

    const newId = `new-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    await sessionManager.upsertSession({
      id: newId,
      vaultName,
      providerId,
      modelId,
      assistantId: assistantId || undefined,
      title: title || '新对话',
    } as any);
    return newId;
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

  // 对话分支：从指定消息位置复制一个新会话
  ipcMain.handle('agent:branch-session', async (_, { sessionId, messageId, title }: { sessionId: string; messageId: string; title?: string }) => {
    const { realSessionRepo, sessionManager, assistantManager, realMessageRepo } = getAgentManagers();
    
    // 1. 获取原会话信息
    const originalSession = await realSessionRepo.getSessionById(sessionId);
    if (!originalSession) {
      throw new Error('原会话不存在');
    }

    // 2. 获取原会话的所有消息
    const allMessages = await realSessionRepo.getMessagesBySession(sessionId, 9999);
    // getMessagesBySession 返回的是倒序再 reverse，所以是从旧到新
    
    // 3. 找到目标消息的位置
    const targetIndex = allMessages.findIndex((m: any) => m.id === messageId);
    if (targetIndex === -1) {
      throw new Error('目标消息不存在');
    }
    
    // 4. 截取到目标消息（包含目标消息）
    const messagesToCopy = allMessages.slice(0, targetIndex + 1);
    
    // 5. 创建新会话
    let vaultName = 'default';
    try {
      const activeVaultPath = await pathService.getActiveVaultPath();
      if (activeVaultPath) {
        vaultName = activeVaultPath.split(/[/\\]/).pop() || 'default';
      }
    } catch(e) {}

    const newSessionId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const branchTitle = title || `${originalSession.title || '对话'} (分支)`;
    
    await sessionManager.upsertSession({
      id: newSessionId,
      vaultName,
      providerId: originalSession.providerId,
      modelId: originalSession.modelId,
      assistantId: originalSession.assistantId || undefined,
      title: branchTitle,
    } as any);

    // 6. 复制消息到新会话
    for (let i = 0; i < messagesToCopy.length; i++) {
      const msg = messagesToCopy[i];
      const newMsgId = crypto.randomUUID();
      
      // 获取原始消息的 parts
      const originalParts = await realMessageRepo.getPartsByMessageId(msg.id);
      
      // 插入消息
      await realSessionRepo.insertMessageWithParts(
        {
          id: newMsgId,
          sessionId: newSessionId,
          role: msg.role,
          orderIndex: i + 1,
          inputTokens: msg.inputTokens,
          outputTokens: msg.outputTokens,
          costMicros: msg.costMicros,
          providerId: msg.providerId,
          modelId: msg.modelId,
        },
        originalParts.map((p: any) => ({
          id: crypto.randomUUID(),
          messageId: newMsgId,
          sessionId: newSessionId,
          type: p.type,
          data: p.data,
        }))
      );
    }

    logger.info(`[Branch] Created branch session ${newSessionId} from ${sessionId}, copied ${messagesToCopy.length} messages`);
    return newSessionId;
  });

  // Provider Discovery API
  ipcMain.handle('agent:get-providers', async () => {
    return await settingsManager.get<any[]>('ai_providers') || [];
  });
}
