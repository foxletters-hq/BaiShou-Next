import { AgentSessionRepository, AgentMessageRepository } from '@baishou/database';
import { AIProviderRegistry } from '@baishou/ai';
import { streamText, CoreMessage } from 'ai';

export class AgentNotFoundError extends Error {
  constructor(id: string) {
    super(`AgentSession ${id} not found`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentService {
  constructor(
    private readonly sessionRepo: AgentSessionRepository,
    private readonly messageRepo: AgentMessageRepository,
    private readonly providerRegistry: AIProviderRegistry
  ) {}

  async chat(sessionId: string, userText: string) {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new AgentNotFoundError(sessionId);

    const provider = this.providerRegistry.getProvider(session.providerId);
    const model = provider.getModel(session.modelId);

    // 获取历史并构造 Vercel AI 格式
    const history = await this.messageRepo.findBySessionId(sessionId, 20);
    const coreMessages: CoreMessage[] = history.map(msg => ({
      role: msg.role as any,
      content: (msg as any).data || '' // 简化：在真实环境中这会是从 AgentParts 组合而来
    }));

    // 存入用户的消息 (由于目前的 Repository 没包含 Part 处理逻辑，暂简化为存 Message)
    await this.messageRepo.create({
      sessionId,
      role: 'user',
      isSummary: false,
      orderIndex: history.length
    }); // 真实场景会有创建 Part 的过程

    coreMessages.push({ role: 'user', content: userText });

    const result = streamText({
      model,
      system: session.systemPrompt ?? undefined,
      messages: coreMessages,
      onFinish: async (event: any) => {
        // 保存助手回答
        await this.messageRepo.create({
          sessionId,
          role: 'assistant',
          isSummary: false,
          providerId: session.providerId,
          modelId: session.modelId,
          orderIndex: history.length + 1,
          inputTokens: event.usage?.promptTokens,
          outputTokens: event.usage?.completionTokens
        });
        if (event.usage) {
          await this.sessionRepo.updateTokenUsage(sessionId, event.usage.promptTokens, event.usage.completionTokens);
        }
      }
    });

    return result;
  }
}
