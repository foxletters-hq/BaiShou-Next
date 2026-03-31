import { AgentSessionRepository, AgentMessageRepository } from '@baishou/database';
import { AIProviderRegistry, AgentToolRegistry } from '@baishou/ai';
import { streamText, CoreMessage } from 'ai';
import { SessionNotFoundError } from '../errors/agent.errors';

export interface AgentChatInput {
  sessionId: string;
  userMessage: string;
  // 以下参数为临时覆盖或自定义传递，可选
  maxSteps?: number;
}

export class AgentService {
  constructor(
    private readonly sessionRepo: AgentSessionRepository,
    private readonly messageRepo: AgentMessageRepository,
    private readonly providerRegistry: AIProviderRegistry,
    private readonly toolRegistry: AgentToolRegistry,
  ) {}

  /**
   * 发起一次流式对话请求。
   * 1:1 复刻旧版白守循环，但是借助 Vercel AI SDK 的 maxSteps 和 tool 特性自动化。
   */
  async streamChat(input: AgentChatInput) {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError(input.sessionId);
    }

    const provider = this.providerRegistry.getProvider(session.providerId);
    const model = provider.getModel(session.modelId);

    // 1. 获取最近对话历史 (假定仓库支持)
    const history = await this.messageRepo.findBySessionId(input.sessionId, 20);
    const messages: CoreMessage[] = history.map(msg => ({
      role: msg.role as any,
      content: (msg as any).data || '' // 对于 tool_calls 和 tool_results 等后续需拓展类型适配
    }));

    // 2. 将此条 User 消息记录到内存上下文，同时存入基础库
    messages.push({ role: 'user', content: input.userMessage });
    
    // 异步存入用户的消息（实际实现可考虑等待其成功或发后台）
    const userMsgTask = this.messageRepo.create({
      sessionId: input.sessionId,
      role: 'user',
      isSummary: false,
      orderIndex: history.length,
      // ...实际应存放内容 parts
    });

    // 3. 构建 tools 环境
    // Vercel 会在生成过程中自动匹配对应的 tools 并执行 
    const vercelTools = this.toolRegistry.toVercelTools({
      sessionId: input.sessionId,
      vaultName: session.vaultName,
    });

    // 4. 调用流式生成接口
    const result = streamText({
      model,
      system: session.systemPrompt ?? undefined,
      messages,
      tools: Object.keys(vercelTools).length > 0 ? vercelTools : undefined,
      maxSteps: input.maxSteps ?? 30, // 自动代理工具的递归调用次数限制
      onFinish: async (event) => {
        // [完成] 当所有步骤（包含工具调用）完成后，同步回写 DB

        // 包含 assistant 的多段生成消息或工具执行结果，遍历存入消息表
        let orderIndex = history.length + 1;
        for (const appendedMsg of event.response.messages) {
          await this.messageRepo.create({
            sessionId: input.sessionId,
            role: appendedMsg.role,
            isSummary: false,
            providerId: session.providerId,
            modelId: session.modelId,
            orderIndex: orderIndex++,
            // 细粒度的 toolCalls 等待数据库 schema 对齐后再做转换支持
          });
        }
        
        // 更新用量和费用估算
        if (event.usage) {
          const { modelPricingService, usdToMicros } = await import('@baishou/shared');
          const costUsd = await modelPricingService.calculateCost(
             session.providerId,
             session.modelId, 
             event.usage.promptTokens, 
             event.usage.completionTokens
          );

          await this.sessionRepo.updateTokenUsage(
            input.sessionId, 
            event.usage.promptTokens, 
            event.usage.completionTokens,
            costUsd !== null ? usdToMicros(costUsd) : 0
          );
        }
      }
    });

    await userMsgTask; // 确保前面的插入发起已完毕
    return result;
  }
}
