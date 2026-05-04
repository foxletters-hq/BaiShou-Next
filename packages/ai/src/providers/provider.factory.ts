import { AiProviderModel, logger } from '@baishou/shared';
import { IAIProvider } from './provider.interface';
import { OpenAIAdaptedProvider } from './openai.provider';
import { GeminiAdaptedProvider } from './gemini.provider';
import { AnthropicAdaptedProvider } from './anthropic.provider';

/**
 * AI 提供商实例工厂
 * 根据跨微服务的 Provider Data Model，动态实例化真实的通信提供商
 */
export class ProviderFactory {
  /**
   * 按指定配置构建临时或持久化的 Provider 适配器
   * 用于大模型列表拉取、连通性测试等依赖真实实例的操作。
   */
  static createProviderFromConfig(config: AiProviderModel): IAIProvider {
    logger.info(`[ProviderFactory] createProviderFromConfig. config.id=${config.id}, config.type=${config.type}, typeof type=${typeof config.type}`);
    switch (config.type.toLowerCase()) {
      case 'openai':
      case 'lmstudio':
      case 'ollama':
      case 'custom':
        // 以上四类往往都遵循兼容 OpenAI 规范的 API 范式
        return new OpenAIAdaptedProvider(config);
      
      case 'gemini':
        return new GeminiAdaptedProvider(config);
      
      case 'anthropic':
        return new AnthropicAdaptedProvider(config);

      default:
        // 未知、意外或尚未专门适配的提供商类型，统一作为兜底方案，交由遵循 OpenAI 规范的适配器处理
        return new OpenAIAdaptedProvider(config);
    }
  }
}
