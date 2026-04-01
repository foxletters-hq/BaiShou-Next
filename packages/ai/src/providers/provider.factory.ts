import { AiProviderModel } from '@baishou/shared';
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
        // 如果遇到了意外或者尚未实现的提供商类型
        throw new Error(`Unsupported AI Provider Type: ${config.type}`);
    }
  }
}
