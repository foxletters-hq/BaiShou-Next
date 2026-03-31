import { createOpenAI, OpenAIProviderSettings } from '@ai-sdk/openai';
import { LanguageModel, EmbeddingModel } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';

/**
 * 通用的兼容 OpenAI 标准 API 格式的 Provider
 * 根据传入配置动态替换 BaseUrl 与 ApiKey
 */
export class OpenAIAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  private sdkInstance: ReturnType<typeof createOpenAI>;

  constructor(config: AiProviderModel) {
    this.config = config;

    const settings: OpenAIProviderSettings = {
      apiKey: config.apiKey,
    };
    
    if (config.baseUrl) {
      settings.baseURL = config.baseUrl;
    }

    this.sdkInstance = createOpenAI(settings);
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gpt-4o';
    return this.sdkInstance(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel<string> {
    const targetModel = modelId || 'text-embedding-3-small';
    return this.sdkInstance.textEmbeddingModel(targetModel) as unknown as EmbeddingModel<string>;
  }

  async fetchAvailableModels(): Promise<string[]> {
    // OpenAI 原生的模型拉取端点。
    // 这里因为 AI SDK 屏蔽了该接口，我们可以使用基础的 fetch 调用
    if (!this.config.apiKey && this.config.type !== 'ollama' && this.config.type !== 'lmstudio') {
      return [];
    }

    const endpoint = this.config.baseUrl ? this.config.baseUrl.replace(/\/$/, '') + '/models' : 'https://api.openai.com/v1/models';
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id);
      }
      return [];
    } catch (e) {
      console.error(`Fetch models error for ${this.config.name}:`, e);
      return [];
    }
  }

  async testConnection(): Promise<void> {
    await this.fetchAvailableModels();
  }
}
