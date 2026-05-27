import { AiProviderModel, logger } from '@baishou/shared'
import { IAIProvider } from './provider.interface'
import { createProviderForType } from './provider-creators'

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
    logger.info(
      `[ProviderFactory] createProviderFromConfig. config.id=${config.id}, config.type=${config.type}, typeof type=${typeof config.type}`
    )
    return createProviderForType(config)
  }
}
