import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderType } from '@baishou/shared';
// 注意：以下类型还在实现过程中，我们遵循 TDD 先测试再跑码
import { AIProviderRegistry } from '../provider.registry';

describe('AIProviderRegistry', () => {
  let registry: AIProviderRegistry;

  beforeEach(() => {
    // 假设 registry 是个纯类的单例模式或可以重置的数据中心
    registry = AIProviderRegistry.getInstance();
    registry.clearProviders();
    registry.initializeDefaultProviders();
  });

  it('should initialize with built-in providers', () => {
    const providers = registry.listProviders();
    expect(providers.length).toBeGreaterThanOrEqual(13); // 内置13种

    const gemini = registry.getProvider('gemini');
    expect(gemini).toBeDefined();
    expect(gemini?.config.type).toBe(ProviderType.Gemini);
  });

  it('should allow removing a provider by id', () => {
    expect(registry.hasProvider('openai')).toBe(true);
    registry.removeProvider('openai');
    expect(registry.hasProvider('openai')).toBe(false);
  });
});
