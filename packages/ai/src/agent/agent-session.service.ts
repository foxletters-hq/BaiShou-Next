import { streamText, wrapLanguageModel, extractReasoningMiddleware, smoothStream, stepCountIs } from 'ai';
import type { LanguageModelV3Middleware } from '@ai-sdk/provider';
import { IAIProvider } from '../providers/provider.interface';
import { ToolRegistry } from '../tools/tool-registry';
import { SessionRepository } from '@baishou/database';
import { MessageAdapter } from './message.adapter';
import { StreamAccumulator } from './stream-accumulator';
import { StreamChunkAdapter } from './stream-chunk.adapter';
import { ChunkType } from './stream-chunk.types';
import type { StreamChunk } from './stream-chunk.types';
import { SystemPromptBuilder } from './system-prompt.builder';
import { logger } from '@baishou/shared';

// --- 新挂载的智慧引擎组件 ---
import { ContextWindowBuilder } from './context-window.builder';
// @ts-ignore
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository';

import { StreamChatOptions, StreamChatCallbacks } from './agent-session.types';
import { persistResult } from './agent-session-persist';

export type { StreamChatOptions, StreamChatCallbacks } from './agent-session.types';

export class AgentSessionService {
  /**
   * 开启一个流式聊天会话。
   * 此方法会自动从数据库汇聚历史，并使用 Vercel AI SDK 发起调用。
   * 它的主要职责是拦截状态并驱动 StreamAccumulator，最后完成 Drizzle 事务落盘。
   */
  async streamChat(options: StreamChatOptions, callbacks?: StreamChatCallbacks): Promise<void> {
    const { 
      sessionId, 
      userText, 
      provider, 
      modelId, 
      toolRegistry, 
      sessionRepo, 
      snapshotRepo,
      systemPrompt, 
      systemModels,
      userConfig,
      attachments,
      contextSnapshots,
      webSearchResultFetcher,
      abortSignal
    } = options;

    try {
      // 1. 获取基础模型，然后用 Vercel 原生 middleware 包装
      const baseModel = provider.getLanguageModel(modelId);
      const middlewares = this.buildMiddlewares(provider);
      const model = middlewares.length > 0
        ? wrapLanguageModel({ model: baseModel as any, middleware: middlewares })
        : baseModel;

      // 2. 加载历史并使用 Builder+Adapter 进行超长截断和压缩感知注入
      const configRecentCount = typeof userConfig?.['recentCount'] === 'number' ? userConfig['recentCount'] : 30;
      
      const dbHistory = await ContextWindowBuilder.build(
          sessionId, 
          sessionRepo, 
          snapshotRepo, 
          { recentCount: configRecentCount }
      );
      const coreMessages = MessageAdapter.toVercelMessages(dbHistory);

      // 2.5. 立即保存用户消息到数据库（解决消息消失问题）
      if (!options.skipUserMessageRecording) {
         const history = await sessionRepo.getMessagesBySession(sessionId, 1);
         const lastOrder = history.length > 0 ? history[0].orderIndex : 0;
         const userOrderIndex = lastOrder + 1;
         const userMsgId = crypto.randomUUID();

         const initialParts: any[] = [
             {
               id: crypto.randomUUID(),
               messageId: userMsgId,
               sessionId,
               type: 'text',
               data: { text: userText },
             }
         ];

         if (attachments && attachments.length > 0) {
            for (const att of attachments) {
               initialParts.push({
                 id: crypto.randomUUID(),
                 messageId: userMsgId,
                 sessionId,
                 type: 'attachment',
                 data: att
               });
            }
         }

         if (contextSnapshots && contextSnapshots.length > 0) {
            initialParts.push({
               id: crypto.randomUUID(),
               messageId: userMsgId,
               sessionId,
               type: 'context_snapshot',
               data: { snapshots: contextSnapshots }
            });
         }

         await sessionRepo.insertMessageWithParts(
           {
             id: userMsgId,
             sessionId,
             role: 'user',
             orderIndex: userOrderIndex,
           },
           initialParts
         );

         // 将用户消息添加到上下文窗口
         if (attachments && attachments.length > 0) {
            const contentParts: any[] = [{ type: 'text', text: userText }];
            for (const att of attachments) {
               if (att.type === 'image') {
                  if (att.url) {
                     contentParts.push({ type: 'image', image: new URL(att.url) });
                  } else if (att.data) {
                     const prefix = `data:${att.mimeType || 'image/jpeg'};base64,`;
                     const base64Data = att.data.startsWith('data:') ? att.data : (prefix + att.data);
                     contentParts.push({ type: 'image', image: base64Data });
                  }
               } else if (att.type === 'file') {
                  contentParts.push({
                     type: 'file',
                     mimeType: att.mimeType || 'application/octet-stream',
                     data: att.url ? new URL(att.url) : (att.data || '')
                  });
               }
            }
            coreMessages.push({ role: 'user', content: contentParts });
         } else {
            coreMessages.push({ role: 'user', content: userText });
         }
      }

      // 3. 构建可用的 Tools 及其底层接续支持
      const { SqliteHybridSearchRepository, MessageRepository } = await import('@baishou/database');
      const { DatabaseAdapter } = await import('../tools/adapters/database.adapter');
      const { EmbeddingAdapter } = await import('../tools/adapters/embedding.adapter');
      
      const drizzleDb = (sessionRepo as any).db || (sessionRepo as any).database;
      const rawClient = drizzleDb?.session?.client || drizzleDb;
      const hsRepo = new SqliteHybridSearchRepository(rawClient);
      const msgRepo = new MessageRepository(drizzleDb);

      const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo);
      let embAdapter = undefined;
      if (systemModels?.embeddingProvider && systemModels?.embeddingModelId) {
         embAdapter = new EmbeddingAdapter(systemModels.embeddingProvider, systemModels.embeddingModelId, hsRepo);
      } else if (provider && modelId && userConfig?.['hasEmbeddingModel']) {
         embAdapter = new EmbeddingAdapter(provider, modelId, hsRepo);
      }

      // 构建记忆去重服务
      let dedupService = undefined;
      if (embAdapter && systemModels?.embeddingProvider && systemModels?.embeddingModelId) {
         const { MemoryDeduplicationServiceImpl } = await import('../rag/memory-deduplication.service');
         dedupService = new MemoryDeduplicationServiceImpl(
           embAdapter, dbAdapter, systemModels.embeddingProvider, systemModels.embeddingModelId
         );
      }

      const sessionObj = await sessionRepo.getSessionById?.(sessionId);

      const enabledTools = toolRegistry.getEnabledToolsAsVercel({
         userConfig: userConfig || {},
         sessionId,
         vaultName: sessionObj?.vaultName || 'default',
         embeddingService: embAdapter,
         vectorStore: dbAdapter,
         messageSearcher: dbAdapter,
         summaryReader: dbAdapter,
         deduplicationService: dedupService,
         diarySearcher: options.diarySearcher,
         webSearchResultFetcher: webSearchResultFetcher
      });

      // --- 灵魂注入 (如果有 Assistant 绑定) ---
      let effectiveSystemPrompt = systemPrompt;
      if (sessionObj?.assistantId) {
         const { AssistantRepository } = await import('@baishou/database');
         const astRepo = new AssistantRepository((sessionRepo as any).db || (sessionRepo as any).database);
         const ast = await astRepo.findById(sessionObj.assistantId);
         if (ast && ast.systemPrompt) {
            effectiveSystemPrompt = ast.systemPrompt;
         }
      }

      const builtSystemPrompt = SystemPromptBuilder.build({
         vaultName: sessionObj?.vaultName || 'default',
         tools: enabledTools as any,
         customPersona: effectiveSystemPrompt,
         userProfileBlock: typeof userConfig?.['userCard'] === 'string' ? userConfig['userCard'] : undefined
      });

      // 4. 调用 Vercel streamText
      const streamResult = await streamText({
        model,
        messages: coreMessages,
        system: builtSystemPrompt,
        tools: enabledTools,
        stopWhen: stepCountIs(10),
        abortSignal,
        experimental_transform: smoothStream(),
      } as any);

      // 5. 使用统一的 StreamChunkAdapter 消费流
      const accumulator = new StreamAccumulator();
      const adapter = new StreamChunkAdapter(accumulator, {
        onChunk: (chunk) => this.dispatchChunkToCallbacks(chunk, callbacks),
      });

      const { error: streamError } = await adapter.consumeStream(streamResult);

      // 记录性能指标
      const metrics = adapter.getMetrics();
      logger.info(`[AgentSessionService] 性能指标: TTFT=${metrics.timeToFirstToken}ms, 总耗时=${metrics.totalDuration}ms, 速度=${metrics.tokensPerSecond} tok/s`);

      if (streamError) {
        logger.warn('[AgentSessionService] Stream encountered a fatal error:', streamError);
      }

      // 6. 落盘
      await persistResult({
        sessionId,
        rawUserText: userText,
        streamResult,
        accumulator,
        sessionRepo,
        snapshotRepo,
        provider,
        modelId,
        skipUserMessageRecording: options.skipUserMessageRecording,
        streamError,
      });

      // 7. 向外抛出完成回调
      if (callbacks?.onFinish) {
        callbacks.onFinish();
      }

    } catch (e: any) {
      logger.error('[AgentSessionService] Error in streamChat:', e);
      if (callbacks?.onError) {
        callbacks.onError(e);
      }
      throw e;
    }
  }

  // ─── 构建 Vercel AI SDK 原生中间件链 ───

  /**
   * 根据 Provider 类型构建 Vercel AI SDK 原生 LanguageModelMiddleware 列表。
   */
  private buildMiddlewares(provider: IAIProvider): LanguageModelV3Middleware[] {
    const middlewares: LanguageModelV3Middleware[] = [];
    const providerType = provider.config?.type || '';

    // 1. 推理提取中间件 — 适用于 DeepSeek-R1、QwQ 等在文本中嵌入 <think> 标签的模型
    if (providerType === 'deepseek' || providerType === 'openai') {
      try {
        middlewares.push(extractReasoningMiddleware({ tagName: 'think' }) as any);
      } catch (e) {
        logger.warn('[AgentSessionService] extractReasoningMiddleware not available:', e);
      }
    }

    return middlewares;
  }

  // ─── 将标准化 Chunk 分发到旧式回调 ───

  /**
   * 将统一的 StreamChunk 分发到 IPC 层的老式回调接口。
   */
  private dispatchChunkToCallbacks(chunk: StreamChunk, callbacks?: StreamChatCallbacks): void {
    if (!callbacks) return;

    switch (chunk.type) {
      case ChunkType.TEXT_DELTA:
        callbacks.onTextDelta?.(chunk.text);
        break;
      case ChunkType.REASONING_DELTA:
        callbacks.onReasoningDelta?.(chunk.text);
        break;
      case ChunkType.TOOL_CALL:
        callbacks.onToolCallStart?.(chunk.toolName, chunk.input);
        break;
      case ChunkType.TOOL_RESULT:
        callbacks.onToolCallResult?.(chunk.toolName, chunk.output);
        break;
      case ChunkType.ERROR:
        if (callbacks.onError && chunk.error instanceof Error) {
          callbacks.onError(chunk.error);
        }
        break;
    }
  }
}
