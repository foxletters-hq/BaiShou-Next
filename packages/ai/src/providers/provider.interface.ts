import { AiProviderModel } from '@baishou/shared';
import { LanguageModel, EmbeddingModel } from 'ai';

/**
 * 统一的 AI 提供商适配器接口
 * 将白守的配置领域模型与 Vercel AI SDK 的执行模型桥接
 */
export interface IAIProvider {
  /**
   * 当前提供商的配置数据
   */
  config: AiProviderModel;

  /**
   * 获取一个适配 Vercel AI SDK 的对话推理模型 
   * @param modelId 指定的按量模型 ID，为空则回退到默认
   */
  getLanguageModel(modelId?: string): LanguageModel;

  /**
   * 获取一个适配 Vercel AI SDK 的文本向量嵌入模型
   * @throws {UnsupportedOperationError} 如果该供应商不支持 Embeddings 则抛出
   */
  getEmbeddingModel(modelId?: string): EmbeddingModel<string>;

  /**
   * 获取该服务商在此 API 密钥/基础网络下在线可调用的模型架构阵列
   */
  fetchAvailableModels(): Promise<string[]>;

  /**
   * 测试该 API Key 组合是否能够成功连接服务
   */
  testConnection(): Promise<void>;
}
