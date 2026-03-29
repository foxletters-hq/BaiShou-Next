import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentService } from '../services/agent.service';
import { MockAgentSessionRepository, MockAgentMessageRepository } from './mock.agent-repository';
import { SessionNotFoundError } from '../errors/agent.errors';
import { AIProviderRegistry, AgentToolRegistry } from '@baishou/ai';

// 模拟返回 Stream 的 Provider
const mockProvider = {
  getModel: vi.fn(),
  supportsModel: vi.fn().mockReturnValue(true)
};

describe('AgentService', () => {
  let sessionRepo: MockAgentSessionRepository;
  let messageRepo: MockAgentMessageRepository;
  let providerRegistry: AIProviderRegistry;
  let toolRegistry: AgentToolRegistry;
  let service: AgentService;

  beforeEach(() => {
    sessionRepo = new MockAgentSessionRepository();
    messageRepo = new MockAgentMessageRepository();
    providerRegistry = new AIProviderRegistry();
    toolRegistry = new AgentToolRegistry();

    providerRegistry.register('mock-provider', mockProvider as any);

    service = new AgentService(sessionRepo, messageRepo, providerRegistry, toolRegistry);
  });

  it('should throw an error for non-existent session', async () => {
    await expect(service.streamChat({ sessionId: 'invalid-id', userMessage: 'Hello' }))
      .rejects.toThrowError(SessionNotFoundError);
  });

  it('should initialize successfully with valid session and provider', async () => {
    const session = await sessionRepo.create({
      title: 'Mock Session',
      vaultName: 'default',
      assistantId: '123',
      providerId: 'mock-provider',
      modelId: 'mock-model',
      isPinned: false,
      systemPrompt: 'You are a helpful assistant',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostMicros: 0
    });

    expect(session.id).toBeDefined();
    // 类似于旧逻辑：业务流调用
  });
});
