import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { logger } from '@baishou/shared'
import { pathService } from './vault.ipc'
import { getAgentManagers, agentService, toolRegistry, createDiarySearcher, createWebSearchResultFetcher, getActiveProvider, buildStreamConfig } from './agent-helpers'
import { settingsManager } from './settings.ipc'
import { GlobalModelsConfig } from '@baishou/shared'
import { ModelPricingService } from '@baishou/ai/src/pricing/model-pricing.service'

let globalAbortController: AbortController | null = null;

// 获取会话的助手上下文轮数配置
async function getAssistantContextWindow(sessionId: string): Promise<number | undefined> {
  try {
    const { realSessionRepo, realAssistantRepo } = getAgentManagers();
    const session = await realSessionRepo.getSessionById(sessionId);
    if (session?.assistantId) {
      const assistant = await realAssistantRepo.findById(session.assistantId);
      if (assistant?.contextWindow !== undefined) {
        return assistant.contextWindow;
      }
    }
  } catch (e) {
    logger.warn('Failed to load assistant context window:', e);
  }
  return undefined;
}

export function registerChatIPC() {
  // ==========================================
  // API: Chat (Stream)
  // ==========================================
  ipcMain.handle('agent:get-messages', async (_, sessionId: string, limit: number = 20, offset: number = 0) => {
    const { realMessageRepo } = getAgentManagers();
    const rows = await realMessageRepo.findBySessionId(sessionId, limit, offset);
    
    const mapped = [];
    for (const msg of rows) {
      const parts = await realMessageRepo.getPartsByMessageId(msg.id);
      
      // 分离 reasoning 和普通 text
      const textParts = parts.filter(p => p.type === 'text');
      const reasoningParts = textParts.filter(p => p.data?.isReasoning);
      const normalTextParts = textParts.filter(p => !p.data?.isReasoning);
      
      const contentText = normalTextParts
        .map(p => p.data?.text || p.data || '')
        .join('\n');
      
      const reasoningText = reasoningParts
        .map(p => p.data?.text || '')
        .join('\n');
        
      const toolInvocations = parts
        .filter((p: any) => p.type === 'tool')
        .map((p: any) => ({
           state: p.data?.status === 'completed' || p.data?.status === 'failed' ? 'result' : 'call',
           toolCallId: p.data?.callId || '',
           toolName: p.data?.name || '',
           args: p.data?.arguments || {},
           result: p.data?.result
        }));

      mapped.push({
        ...msg,
        content: contentText,
        reasoning: reasoningText || undefined,
        toolInvocations: toolInvocations.length > 0 ? toolInvocations : undefined,
        parts
      });
    }
    return mapped;
  });
  
  ipcMain.handle('agent:delete-message', async (_, sessionId: string, messageId: string) => {
    const { realSessionRepo } = getAgentManagers();
    await realSessionRepo.deleteMessageAndFollowing(sessionId, messageId);
    return true;
  });

  ipcMain.handle('agent:chat', async (event, args: { sessionId: string; text: string; providerId?: string; modelId?: string; attachments?: any[]; searchMode?: boolean }) => {
    try {
      const { realSessionRepo, realSnapshotRepo, sessionManager, realAssistantRepo } = getAgentManagers();
      
      // [Intercept and Copy Attachments]
      let finalAttachments = args.attachments;
      if (finalAttachments && finalAttachments.length > 0) {
        try {
          const attachBase = await pathService.getAttachmentsBaseDirectory();
          const safeSessionId = args.sessionId.replace(/[\\/]/g, '');
          const sessionAttachDir = path.join(attachBase, safeSessionId);
          
          await fs.mkdir(sessionAttachDir, { recursive: true });
          
          finalAttachments = await Promise.all(finalAttachments.map(async (att) => {
            if (att.filePath && att.fileName) {
               const ext = path.extname(att.filePath) || path.extname(att.fileName);
               const originalName = path.parse(att.fileName).name;
               const newFileName = `${originalName}_${Date.now()}${ext}`;
               const destPath = path.join(sessionAttachDir, newFileName);
               
               try {
                 await fs.copyFile(att.filePath, destPath);
                 att.url = `file://${destPath.replace(/\\/g, '/')}`;
                 att.filePath = destPath;
               } catch (copyErr) {
                 logger.error('Failed to copy attachment:', att.filePath, copyErr);
                 att.url = `file://${att.filePath.replace(/\\/g, '/')}`;
               }
            } else if (att.data && !att.url) {
               const ext = '.png';
               const newFileName = `pasted_${Date.now()}${ext}`;
               const destPath = path.join(sessionAttachDir, newFileName);
               try {
                 const buffer = Buffer.from(att.data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
                 await fs.writeFile(destPath, buffer);
                 att.url = `file://${destPath.replace(/\\/g, '/')}`;
               } catch (e) {
                 logger.error('Failed to copy base64 attachment', e);
               }
            }
            return att;
          }));
        } catch (e) {
          logger.error('Attachments processing failed:', e);
        }
      }

      // 获取会话的助手配置
      let assistantContextWindow: number | undefined;
      try {
        const session = await realSessionRepo.getSessionById(args.sessionId);
        if (session?.assistantId) {
          const assistant = await realAssistantRepo.findById(session.assistantId);
          if (assistant?.contextWindow !== undefined) {
            assistantContextWindow = assistant.contextWindow;
          }
        }
      } catch (e) {
        logger.warn('Failed to load assistant context window:', e);
      }

      const { provider, globalModels, systemModels, userConfig } = await buildStreamConfig(args.providerId, args.modelId, args.searchMode, assistantContextWindow);
      
      globalAbortController = new AbortController();
      
      await agentService.streamChat({
        sessionId: args.sessionId,
        userText: args.text,
        provider: provider,
        modelId: args.modelId || globalModels?.globalDialogueModelId || 'deepseek-chat',
        systemModels,
        userConfig: userConfig,
        attachments: finalAttachments,
        toolRegistry: toolRegistry,
        sessionRepo: realSessionRepo as any,
        snapshotRepo: realSnapshotRepo as any,
        diarySearcher: createDiarySearcher(),
        webSearchResultFetcher: createWebSearchResultFetcher(),
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
        logger.error('Agent IPC persistence SSOT Error', e);
      }
      return true
    } catch (error: any) {
      if (error.name === 'AbortError') {
         event.sender.send('agent:stream-finish', { success: true });
         return true;
      }
      logger.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', { error: error.message || 'Stream Error' })
      return false
    } finally {
      globalAbortController = null;
    }
  });
  
  ipcMain.handle('agent:regenerate', async (event, sessionId: string, messageId?: string, searchMode?: boolean) => {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers();
    
    let targetMessage;
    if (messageId) {
        targetMessage = await realSessionRepo.getMessageById(messageId);
    }

    let userMessage;
    if (targetMessage && targetMessage.role === 'assistant') {
        const messages = await realSessionRepo.getMessagesBySession(sessionId, 100);
        const idx = messages.findIndex((m: any) => m.id === messageId);
        for (let i = idx - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
                userMessage = messages[i];
                break;
            }
        }
    } else if (targetMessage && targetMessage.role === 'user') {
        userMessage = targetMessage;
    }

    if (!userMessage) {
        const messages = await realSessionRepo.getMessagesBySession(sessionId, 5);
        userMessage = messages.find((m: any) => m.role === 'user');
    }

    if (!userMessage) return false;

    await realSessionRepo.deleteMessagesAfter(sessionId, userMessage.orderIndex);
    
    const assistantContextWindow = await getAssistantContextWindow(sessionId);
    const { provider, globalModels, systemModels, userConfig } = await buildStreamConfig(undefined, undefined, searchMode, assistantContextWindow);
    globalAbortController = new AbortController();

    try {
        await agentService.streamChat({
          sessionId,
          userText: (userMessage.parts && userMessage.parts.length > 0) ? userMessage.parts.filter((p:any) => p.type === 'text').map((p:any) => p.data?.text || p.data).join('\n') : '',
          provider,
          modelId: globalModels?.globalDialogueModelId || 'deepseek-chat',
          systemModels,
          userConfig,
          skipUserMessageRecording: true,
          toolRegistry,
          sessionRepo: realSessionRepo as any,
          snapshotRepo: realSnapshotRepo as any,
          diarySearcher: createDiarySearcher(),
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

  ipcMain.handle('agent:edit-message', async (event, sessionId: string, messageId: string, newText: string, requestedProviderId?: string, requestedModelId?: string, attachments?: any[], searchMode?: boolean) => {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers();
    
    // [Intercept and Copy Attachments]
    let finalAttachments = attachments;
    if (finalAttachments && finalAttachments.length > 0) {
      try {
        const attachBase = await pathService.getAttachmentsBaseDirectory();
        const safeSessionId = sessionId.replace(/[\\/]/g, '');
        const sessionAttachDir = path.join(attachBase, safeSessionId);
        
        await fs.mkdir(sessionAttachDir, { recursive: true });
        
        finalAttachments = await Promise.all(finalAttachments.map(async (att) => {
          if (att.filePath && att.fileName) {
             const ext = path.extname(att.filePath) || path.extname(att.fileName);
             const originalName = path.parse(att.fileName).name;
             const newFileName = `${originalName}_${Date.now()}${ext}`;
             const destPath = path.join(sessionAttachDir, newFileName);
             
             try {
               await fs.copyFile(att.filePath, destPath);
               att.url = `file://${destPath.replace(/\\/g, '/')}`;
               att.filePath = destPath;
             } catch (copyErr) {
               logger.error('Failed to copy attachment:', att.filePath, copyErr);
               att.url = `file://${att.filePath.replace(/\\/g, '/')}`;
             }
          } else if (att.data && !att.url) {
             const ext = '.png';
             const newFileName = `pasted_${Date.now()}${ext}`;
             const destPath = path.join(sessionAttachDir, newFileName);
             try {
               const buffer = Buffer.from(att.data.replace(/^data:image\/\w+;base64,/, ''), 'base64');
               await fs.writeFile(destPath, buffer);
               att.url = `file://${destPath.replace(/\\/g, '/')}`;
             } catch (e) {
               logger.error('Failed to copy base64 attachment', e);
             }
          }
          return att;
        }));
      } catch (e) {
        logger.error('Attachments processing failed:', e);
      }
    }

    const targetMsg = await realSessionRepo.getMessageById(messageId);
    if (!targetMsg) return false;

    await realSessionRepo.updateMessageTextPart(messageId, newText);

    if (targetMsg.role === 'assistant') {
       event.sender.send('agent:stream-finish', { success: true });
       return true;
    }

    await realSessionRepo.deleteMessagesAfter(sessionId, targetMsg.orderIndex);
    
    const assistantContextWindow = await getAssistantContextWindow(sessionId);
    const { provider, globalModels, systemModels, userConfig } = await buildStreamConfig(requestedProviderId, requestedModelId, searchMode, assistantContextWindow);
    globalAbortController = new AbortController();

    try {
        await agentService.streamChat({
          sessionId,
          userText: newText,
          provider,
          modelId: requestedModelId || globalModels?.globalDialogueModelId || 'deepseek-chat',
          systemModels,
          userConfig,
          skipUserMessageRecording: true,
          attachments: finalAttachments,
          toolRegistry,
          sessionRepo: realSessionRepo as any,
          snapshotRepo: realSnapshotRepo as any,
          diarySearcher: createDiarySearcher(),
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

  // 重发消息：保留用户消息，删除之后的所有助手回复，然后重新发送
  ipcMain.handle('agent:resend', async (event, sessionId: string, messageId: string, searchMode?: boolean) => {
    const { realSessionRepo, realSnapshotRepo, sessionManager } = getAgentManagers();

    logger.info(`[Agent:resend] 开始重发消息: sessionId=${sessionId}, messageId=${messageId}`);

    // 1. 获取目标消息
    const targetMsg = await realSessionRepo.getMessageById(messageId);
    if (!targetMsg) {
      logger.error(`[Agent:resend] 消息不存在: messageId=${messageId}`);
      event.sender.send('agent:stream-finish', { error: '消息不存在' });
      return false;
    }

    logger.info(`[Agent:resend] 找到目标消息: id=${targetMsg.id}, role=${targetMsg.role}, orderIndex=${targetMsg.orderIndex}`);

    // 2. 获取消息的文本内容
    const messages = await realSessionRepo.getMessagesBySession(sessionId, 1000);
    const targetWithParts = messages.find((m: any) => m.id === messageId);
    if (!targetWithParts) {
      logger.error(`[Agent:resend] 无法获取消息内容: messageId=${messageId}`);
      event.sender.send('agent:stream-finish', { error: '无法获取消息内容' });
      return false;
    }

    // 提取文本内容
    const textParts = targetWithParts.parts?.filter((p: any) => p.type === 'text') || [];
    const userText = textParts.map((p: any) => p.data?.text || '').join('\n');
    if (!userText) {
      logger.error(`[Agent:resend] 消息内容为空: messageId=${messageId}`);
      event.sender.send('agent:stream-finish', { error: '消息内容为空' });
      return false;
    }

    // 3. 只删除该消息之后的所有消息（保留用户消息本身）
    logger.info(`[Agent:resend] 删除 orderIndex > ${targetMsg.orderIndex} 的消息`);
    await realSessionRepo.deleteMessagesAfter(sessionId, targetMsg.orderIndex);

    // 验证删除后的消息列表
    const remainingMessages = await realSessionRepo.getMessagesBySession(sessionId, 1000);
    logger.info(`[Agent:resend] 删除后剩余消息数: ${remainingMessages.length}`);
    logger.info(`[Agent:resend] 剩余消息 IDs: ${remainingMessages.map(m => m.id).join(', ')}`);

    // 4. 重新发送消息（带完整上下文）
    try {
      const assistantContextWindow = await getAssistantContextWindow(sessionId);
      const { provider, globalModels, systemModels, userConfig } = await buildStreamConfig(undefined, undefined, searchMode, assistantContextWindow);
      globalAbortController = new AbortController();

      await agentService.streamChat({
        sessionId,
        userText,
        provider,
        modelId: globalModels?.globalDialogueModelId || 'deepseek-chat',
        systemModels,
        userConfig,
        skipUserMessageRecording: true,
        toolRegistry,
        sessionRepo: realSessionRepo as any,
        snapshotRepo: realSnapshotRepo as any,
        diarySearcher: createDiarySearcher(),
        abortSignal: globalAbortController.signal
      }, {
        onTextDelta: (chunk) => event.sender.send('agent:stream-chunk', chunk),
        onReasoningDelta: (chunk) => event.sender.send('agent:reasoning-chunk', chunk),
        onToolCallStart: (name, args) => event.sender.send('agent:tool-start', { name, args }),
        onToolCallResult: (name, result) => event.sender.send('agent:tool-result', { name, result }),
        onError: (err) => event.sender.send('agent:stream-finish', { error: err.message }),
        onFinish: () => event.sender.send('agent:stream-finish', { success: true })
      });

      try {
        await sessionManager.flushSessionToDisk(sessionId);
      } catch (e) {
        logger.error('Agent IPC persistence SSOT Error', e);
      }

      const finalMessages = await realSessionRepo.getMessagesBySession(sessionId, 1000);
      logger.info(`[Agent:resend] 完成后消息数: ${finalMessages.length}`);
      logger.info(`[Agent:resend] 完成后消息 IDs: ${finalMessages.map(m => `${m.id}(${m.role})`).join(', ')}`);

      return true;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        event.sender.send('agent:stream-finish', { success: true });
        return true;
      }
      logger.error('Agent resend error:', error);
      event.sender.send('agent:stream-finish', { error: error.message || 'Resend Error' });
      return false;
    } finally {
      globalAbortController = null;
    }
  });

  // ==========================================
  // API: TTS (Text-to-Speech)
  // ==========================================
  ipcMain.handle('agent:tts-synthesize', async (_event, text: string, providerId?: string, modelId?: string) => {
    try {
      const providers = await settingsManager.get<any[]>('ai_providers') || [];
      const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models');

      const ttsProviderId = providerId || globalModels?.globalTtsProviderId;
      const ttsModelId = modelId || globalModels?.globalTtsModelId;

      if (!ttsProviderId || !ttsModelId) {
        return { success: false, error: 'TTS model not configured. Please set a TTS model in Settings > Global Models.' };
      }

      const providerConfig = providers.find((p: any) => p.id === ttsProviderId);
      if (!providerConfig) {
        return { success: false, error: `TTS provider "${ttsProviderId}" not found.` };
      }

      const apiKey = providerConfig.apiKey;
      const baseUrl = (providerConfig.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
      const ttsEndpoint = `${baseUrl}/audio/speech`;

      const response = await fetch(ttsEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ttsModelId,
          input: text,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        logger.error(`[TTS] API error ${response.status}: ${errText}`);
        return { success: false, error: `TTS API error: ${response.status} ${response.statusText}` };
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return { success: true, audioBase64: base64, format: 'mp3' };
    } catch (error: any) {
      logger.error('[TTS] Synthesize error:', error);
      return { success: false, error: error.message || 'TTS synthesis failed' };
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
      logger.error('File Picker Error:', err)
      return []
    }
  })

  // ==========================================
  // API: Pricing
  // ==========================================
  ipcMain.handle('pricing:get-last-updated', async () => {
    const pricingService = ModelPricingService.getInstance();
    return pricingService.lastFetchTime?.toISOString() || null;
  })

  ipcMain.handle('pricing:refresh', async () => {
    try {
      const pricingService = ModelPricingService.getInstance();
      await pricingService.forceRefresh();
      return { success: true, lastUpdated: pricingService.lastFetchTime?.toISOString() || null };
    } catch (e: any) {
      logger.error('Failed to refresh pricing:', e);
      return { success: false, error: e.message };
    }
  })
}
