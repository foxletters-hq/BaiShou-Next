import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel, EmbeddingModel } from 'ai';
import { AiProviderModel } from '@baishou/shared';
import { IAIProvider } from './provider.interface';

export class AnthropicAdaptedProvider implements IAIProvider {
  public config: AiProviderModel;
  private sdkInstance: ReturnType<typeof createAnthropic>;

  constructor(config: AiProviderModel) {
    this.config = config;

    this.sdkInstance = createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }

  getLanguageModel(modelId?: string): LanguageModel {
    const targetModel = modelId || this.config.defaultDialogueModel || 'claude-3-opus-20240229';
    return this.sdkInstance(targetModel) as unknown as LanguageModel;
  }

  getEmbeddingModel(_modelId?: string): EmbeddingModel<string> {
    // Anthropic 官方目前未提供 embedding_model 对应 @ai-sdk/anthropic 的原生支持
    throw new Error('Embedding is not supported natively by Anthropic adapted provider yet');
  }

  async fetchAvailableModels(): Promise<string[]> {
    return [
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022', 
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }

  async testConnection(): Promise<void> {
    if (!this.config.apiKey) throw new Error('Anthropic API Key is required');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      })
    });
    if (!res.ok) throw new Error(`Anthropic connection test failed: ${res.statusText}`);
  }
}
