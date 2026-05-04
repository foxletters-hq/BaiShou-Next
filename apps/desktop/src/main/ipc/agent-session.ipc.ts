import { ipcMain } from 'electron'
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

  // Provider Discovery API
  ipcMain.handle('agent:get-providers', async () => {
    return await settingsManager.get<any[]>('ai_providers') || [];
  });
}
