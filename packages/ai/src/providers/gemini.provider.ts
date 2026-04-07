import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel, EmbeddingModel, generateText } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';
import { getRotatedApiKey } from './provider.utils';

export class GeminiAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  constructor(config: AiProviderModel) {
    this.config = config;
  }

  private _getSdk() {
    const rotatedKey = getRotatedApiKey(this.config);
    return createGoogleGenerativeAI({
      apiKey: rotatedKey || this.config.apiKey,
      baseURL: this.config.baseUrl || undefined,
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'gemini-1.5-pro';
    return this._getSdk()(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(modelId?: string): EmbeddingModel {
    const targetModel = modelId || 'text-embedding-004';
    return this._getSdk().textEmbeddingModel(targetModel) as unknown as EmbeddingModel;
  }

  async fetchAvailableModels(): Promise<string[]> {
    const apiKey = getRotatedApiKey(this.config) || this.config.apiKey;
    if (!apiKey) return [];
    
    let baseURL = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    baseURL = baseURL.replace(/\/+$/, '');

    try {
      const res = await fetch(`${baseURL}/models?key=${apiKey}`);
      if (!res.ok) {
        let errMessage = res.statusText;
        try {
          const errBody = await res.json();
          if (errBody.error && errBody.error.message) {
            errMessage = errBody.error.message;
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(`Failed to fetch models: ${res.status} ${errMessage}`);
      }
      const data = await res.json();
      return (data.models || [])
        .map((m: any) => m.name?.replace('models/', '') || '')
        .filter(Boolean);
    } catch (e: any) {
      console.error('Gemini fetchAvailableModels error:', e);
      throw new Error(`Failed to fetch Gemini models: ${e.message || 'Unknown network error'}`);
    }
  }

  async testConnection(testModelId?: string): Promise<void> {
    // 优先使用用户选择的模型，然后才是配置中已有的模型，最后才用稳定保底值
    const modelToTest = 
      testModelId ||
      this.config.defaultDialogueModel ||
      (this.config.enabledModels && this.config.enabledModels.length > 0 ? this.config.enabledModels[0] : null) ||
      (this.config.models && this.config.models.length > 0 ? this.config.models[0] : null) ||
      'gemini-2.0-flash';   // Gemini 最新稳定保底

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
