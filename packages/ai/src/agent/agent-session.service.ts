import { streamText, StreamTextResult } from 'ai';
import { IAIProvider } from '../providers/provider.interface';
import { ToolRegistry } from '../tools/tool-registry';
import { SessionRepository } from '@baishou/database';
import { MessageAdapter } from './message.adapter';
import { StreamAccumulator } from './stream-accumulator';
import { ModelPricingService } from '../pricing/model-pricing.service';
import { SystemPromptBuilder } from './system-prompt.builder';

// --- 新挂载的智慧引擎组件 ---
import { ContextWindowBuilder } from './context-window.builder';
import { TitleGeneratorService } from './title-generator.service';
import { ContextCompressorService } from './context-compressor.service';
// @ts-ignore
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository';

export interface AttachmentInput {
  type: 'image' | 'file';
  url?: string;
  data?: string; // base64
  mimeType?: string;
  name?: string;
}

export interface StreamChatOptions {
  sessionId: string;
  userText: string;
  provider: IAIProvider;
  modelId: string;
  toolRegistry: ToolRegistry;
  sessionRepo: SessionRepository;
  snapshotRepo: SnapshotRepository;
  systemPrompt?: string;
  userConfig?: Record<string, unknown>;
  attachments?: AttachmentInput[];
  contextSnapshots?: { title?: string; content: string }[];
  abortSignal?: AbortSignal;
}

export interface StreamChatCallbacks {
  onTextDelta?: (text: string) => void;
  onReasoningDelta?: (text: string) => void;
  onToolCallStart?: (toolName: string, args: unknown) => void;
  onToolCallResult?: (toolName: string, result: unknown) => void;
  onError?: (error: Error) => void;
  onFinish?: () => void;
}

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
      userConfig,
      attachments,
      contextSnapshots,
      abortSignal
    } = options;

    try {
      // 1. 获取模型
      const model = provider.getLanguageModel(modelId);

      // 2. 加载历史并使用 Builder+Adapter 进行超长截断和压缩感知注入
      const configRecentCount = typeof userConfig?.['recentCount'] === 'number' ? userConfig['recentCount'] : 30;
      
      const dbHistory = await ContextWindowBuilder.build(
          sessionId, 
          sessionRepo, 
          snapshotRepo, 
          { recentCount: configRecentCount }
      );
      const coreMessages = MessageAdapter.toVercelMessages(dbHistory);

      // 追加当前用户的发送内容
      coreMessages.push({ role: 'user', content: userText });

      // 3. 构建可用的 Tools 及其底层接续支持
      const { SqliteHybridSearchRepository, MessageRepository } = await import('@baishou/database');
      const { DatabaseAdapter } = await import('../tools/adapters/database.adapter');
      const { EmbeddingAdapter } = await import('../tools/adapters/embedding.adapter');
      
      const hsRepo = new SqliteHybridSearchRepository((sessionRepo as any).db || (sessionRepo as any).database);
      const msgRepo = new MessageRepository((sessionRepo as any).db || (sessionRepo as any).database);

      const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo);
      const embAdapter = new EmbeddingAdapter(provider, modelId, hsRepo);

      const sessionObj = await sessionRepo.getSessionById?.(sessionId);

      const enabledTools = toolRegistry.getEnabledToolsAsVercel({
         userConfig: userConfig || {},
         sessionId,
         vaultName: sessionObj?.vaultName || 'default',
         embeddingService: embAdapter,
         vectorStore: dbAdapter,
         messageSearcher: dbAdapter,
         summaryReader: dbAdapter
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
        maxSteps: 5, // 开启强效自动调用工具特性 (多轮递归直至工具完结)
        abortSignal,
      });

      const accumulator = new StreamAccumulator();

      // 这里直接返回 streamText 的迭代，但是我们在后台异步消费它
      await this.consumeAndPersistStream({
        sessionId,
        rawUserText: userText,
        streamResult, 
        accumulator, 
        sessionRepo, 
        snapshotRepo,
        provider,
        modelId,
        attachments,
        contextSnapshots,
        callbacks
      });

    } catch (e: any) {
      console.error('[AgentSessionService] Error in streamChat:', e);
      if (callbacks?.onError) {
        callbacks.onError(e);
      }
      throw e;
    }
  }

  /**
   * 异步消费 streamText 的完整输出流（fullStream）。
   * 实时将解析后的内容通过回调发送给 UI，并在终点执行落盘。
   */
  private async consumeAndPersistStream(params: {
    sessionId: string;
    rawUserText: string;
    streamResult: StreamTextResult<any, any>;
    accumulator: StreamAccumulator;
    sessionRepo: SessionRepository;
    snapshotRepo: SnapshotRepository;
    provider: IAIProvider;
    modelId: string;
    attachments?: AttachmentInput[];
    contextSnapshots?: { title?: string; content: string }[];
    callbacks?: StreamChatCallbacks;
  }): Promise<void> {
     const { sessionId, rawUserText, streamResult, accumulator, sessionRepo, snapshotRepo, provider, modelId, attachments, contextSnapshots, callbacks } = params;

     // 首先立刻把用户说的这句话存进数据库！
     // 由于是新的，我们先计算一个 orderIndex
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
           data: { text: rawUserText }, // JSON 自动入库
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

     // ======== 开始吞吐流 ========
     if (!streamResult.fullStream) return;
     
     const reader = streamResult.fullStream.getReader();

     while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        // 交给累积器保存进度
        accumulator.add(value);

        // 如果是部分我们关心的事件流形式，同步发送给 UI
        if (value.type === 'text-delta' && callbacks?.onTextDelta) {
           const chunkStr = (value as any).textDelta || (value as any).text;
           if (chunkStr) callbacks.onTextDelta(chunkStr);
        }
        else if ((value.type as string) === 'reasoning-delta' && callbacks?.onReasoningDelta) {
           const chunkStr = (value as any).textDelta || (value as any).text;
           if (chunkStr) callbacks.onReasoningDelta(chunkStr);
        }
        else if (value.type === 'tool-call' && callbacks?.onToolCallStart) {
           // 工具开始工作
           callbacks.onToolCallStart(value.toolName, value.args);
        }
        else if (value.type === 'tool-result' && callbacks?.onToolCallResult) {
           callbacks.onToolCallResult(value.toolName, value.result);
        }
     }

     // ======== 处理完毕，进入 Finish 并完成原子落表 ========
     const assistantMsgId = crypto.randomUUID();
     const partsToInsert: any[] = [];

     // 推送文本 Part
     if (accumulator.text) {
       partsToInsert.push({
          id: crypto.randomUUID(),
          messageId: assistantMsgId,
          sessionId,
          type: 'text',
          data: { text: accumulator.text }
       });
     }

     // 推送推理 Part (如果有)
     if (accumulator.reasoning) {
       partsToInsert.push({
          id: crypto.randomUUID(),
          messageId: assistantMsgId,
          sessionId,
          type: 'text',
          data: { text: accumulator.reasoning, isReasoning: true } // 白守老版本可能存做特殊属性，或者拆新 Type
       });
     }

     // 推送工具 Call & Result Part
     // 因为 AI SDK 的 ToolCall 和 ToolResult 是分开进来的，我们在 accumulator 里存了。
     for (const tc of accumulator.toolCalls) {
       const resultObj = accumulator.toolResults.find(tr => tr.callId === tc.callId);
       partsToInsert.push({
          id: crypto.randomUUID(),
          messageId: assistantMsgId,
          sessionId,
          type: 'tool',
          data: {
             callId: tc.callId,
             name: tc.name,
             arguments: tc.arguments,
             result: resultObj ? resultObj.result : undefined,
             status: resultObj ? 'completed' : 'failed'
          }
       });
     }

     // 开始事务存放!
     await sessionRepo.insertMessageWithParts(
       {
         id: assistantMsgId,
         sessionId,
         role: 'assistant',
         orderIndex: userOrderIndex + 1,
       },
       partsToInsert
     );

     // 累加计算 tokens 及账单微美分成本
     const costMicros = await ModelPricingService.getInstance().calculateCostMicros(provider.config.id, modelId, {
        inputTokens: accumulator.usage.inputTokens,
        outputTokens: accumulator.usage.outputTokens
     });

     await sessionRepo.updateTokenUsage(
        sessionId,
        accumulator.usage.inputTokens,
        accumulator.usage.outputTokens,
        costMicros
     );

     // ==========================================
     // 触发闲置后台服务 (不阻塞用户收到结束的回调)
     // ==========================================
     setTimeout(() => {
        // 检测新对话（由于可能前面只有欢迎语、第一次对话等，通常 Order 较小）
        if (userOrderIndex <= 2) {
           TitleGeneratorService.autoTitle(provider, modelId, sessionRepo, sessionId, rawUserText);
        }
        
        // 并行起跳长文压缩归纳检测机
        ContextCompressorService.compress(provider, modelId, sessionRepo, snapshotRepo, sessionId);
     }, 500);

     // 向外抛出回调
     if (callbacks?.onFinish) {
       callbacks.onFinish();
     }
  }
}
