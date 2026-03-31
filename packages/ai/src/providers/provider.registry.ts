import { AiProviderModel, ProviderType, createAiProvider } from '@baishou/shared';
import { IAIProvider } from './provider.interface';
import { OpenAIAdaptedProvider } from './openai.provider';
import { GeminiAdaptedProvider } from './gemini.provider';
import { AnthropicAdaptedProvider } from './anthropic.provider';

/**
 * 全局 AI 提供商中心注册表
 * 负责各服务提供商对象的缓存生命周期、检索和维护
 */
export class AIProviderRegistry {
  private static instance: AIProviderRegistry;
  private providers: Map<string, IAIProvider> = new Map();

  private constructor() {}

  public static getInstance(): AIProviderRegistry {
    if (!AIProviderRegistry.instance) {
      AIProviderRegistry.instance = new AIProviderRegistry();
    }
    return AIProviderRegistry.instance;
  }

  /**
   * 清除所有缓存的支持商实例
   */
  public clearProviders(): void {
    this.providers.clear();
  }

  /**
   * 加载默认的内置 13 种生态提供商字典配置
   */
  public initializeDefaultProviders(): void {
    const builtinIds = Object.values(ProviderType);
    for (const type of builtinIds) {
      if (type === ProviderType.Custom) continue;
      
      const config = createAiProvider({
        id: type,
        name: type.charAt(0).toUpperCase() + type.slice(1), /* 临时命名规则，可按需补充细化 */
        type: type as ProviderType,
      });

      this.providers.set(config.id, this.createProviderInstance(config));
    }
  }

  /**
   * 返回当前系统中可用的全部 Provider 实例列表
   */
  public listProviders(): IAIProvider[] {
    return Array.from(this.providers.values())
      .sort((a, b) => a.config.sortOrder - b.config.sortOrder);
  }

  /**
   * 根据 ID 安全地获取指定的服务提供商实例
   */
  public getProvider(id: string): IAIProvider | undefined {
    return this.providers.get(id);
  }

  public hasProvider(id: string): boolean {
    return this.providers.has(id);
  }

  public removeProvider(id: string): void {
    this.providers.delete(id);
  }

  public registerProvider(provider: IAIProvider): void {
    this.providers.set(provider.config.id, provider);
  }

  /**
   * 内部工厂临时桩，待具体 Provider 实现完毕后将补充基于 config.type 的分发调度
   */
  private createProviderInstance(config: AiProviderModel): IAIProvider {
    switch (config.type) {
      case ProviderType.Gemini:
        return new GeminiAdaptedProvider(config);
      case ProviderType.Anthropic:
        return new AnthropicAdaptedProvider(config);
      default:
        // OpenAI, DeepSeek, Grok, Kimi, Ollama 等兼容层处理
        return new OpenAIAdaptedProvider(config);
    }
  }
}
