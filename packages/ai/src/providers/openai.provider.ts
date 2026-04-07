import { createOpenAI } from '@ai-sdk/openai';
import { LanguageModel, EmbeddingModel, generateText } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';
import { getRotatedApiKey } from './provider.utils';

/**
 * 通用的兼容 OpenAI 标准 API 格式的 Provider
 * 根据传入配置动态替换 BaseUrl 与 ApiKey
 */
export class OpenAIAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  constructor(config: AiProviderModel) {
    this.config = config;
  }

  private _getSdk() {
    const rotatedKey = getRotatedApiKey(this.config);
    return createOpenAI({
      apiKey: rotatedKey || this.config.apiKey,
      baseURL: this.config.baseUrl || undefined,
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gpt-4o';
    // Use .chat() to ensure we hit /v1/chat/completions instead of the new Responses API (/v1/responses)
    return this._getSdk().chat(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel {
    const targetModel = modelId || 'text-embedding-3-small';
    return this._getSdk().textEmbeddingModel(targetModel) as unknown as EmbeddingModel;
  }

  async fetchAvailableModels(): Promise<string[]> {
    // OpenAI 原生的模型拉取端点。
    // 这里因为 AI SDK 屏蔽了该接口，我们可以使用基础的 fetch 调用
    const apiKey = getRotatedApiKey(this.config) || this.config.apiKey;
    if (!apiKey && this.config.type !== 'ollama' && this.config.type !== 'lmstudio') {
      return [];
    }

    const endpoint = this.config.baseUrl ? this.config.baseUrl.replace(/\/$/, '') + '/models' : 'https://api.openai.com/v1/models';
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id);
      }
      throw new Error(`Invalid response format from API. Expected data array.`);
    } catch (e: any) {
      console.error(`Fetch models error for ${this.config.name}:`, e);
      throw new Error(e.message || 'Unknown network error');
    }
  }

  async testConnection(testModelId?: string): Promise<void> {
    const modelToTest = testModelId || 
      this.config.defaultDialogueModel || 
      (this.config.enabledModels && this.config.enabledModels.length > 0 ? this.config.enabledModels[0] : null) ||
      (this.config.models && this.config.models.length > 0 ? this.config.models[0] : null);

    if (!modelToTest) {
      throw new Error('No usable model found. Please fetch models first.');
    }

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort('Connection timeout'), 15000);

      await generateText({
        model: this.getLanguageModel(modelToTest),
        prompt: 'test',
        maxOutputTokens: 1,
        abortSignal: abortController.signal,
      });

      clearTimeout(timeoutId);
    } catch (e: any) {
      console.error(`Test connection error for ${this.config.name}:`, e);
      throw new Error(`Connection test failed: ${e.message || 'Unknown network error'}`);
    }
  }
}
