import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel, EmbeddingModel } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';

export class GeminiAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  private sdkInstance: ReturnType<typeof createGoogleGenerativeAI>;

  constructor(config: AiProviderModel) {
    this.config = config;

    this.sdkInstance = createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gemini-1.5-pro';
    return this.sdkInstance(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel<string> {
    const targetModel = modelId || 'text-embedding-004';
    return this.sdkInstance.textEmbeddingModel(targetModel) as unknown as EmbeddingModel<string>;
  }

  async fetchAvailableModels(): Promise<string[]> {
    // 简化处理，由于 Google Gemini SDK 端点可能不一样，可以按需返回配置数组
    return ['gemini-1.5-pro', 'gemini-1.5-flash'];
  }

  async testConnection(): Promise<void> {
    // 临时桩
    return Promise.resolve();
  }
}
