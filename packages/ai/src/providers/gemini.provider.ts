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
    const apiKey = this.config.apiKey;
    if (!apiKey) return [];
    
    const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com';
    try {
      const res = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      return (data.models || [])
        .map((m: any) => m.name?.replace('models/', '') || '')
        .filter(Boolean);
    } catch (e) {
      console.error('Gemini fetchAvailableModels error:', e);
      return ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    }
  }

  async testConnection(): Promise<void> {
    const models = await this.fetchAvailableModels();
    if (models.length === 0) throw new Error('Unable to connect to Gemini API');
  }
}
