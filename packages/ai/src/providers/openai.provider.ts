import { createOpenAI, OpenAIProviderSettings } from '@ai-sdk/openai';
import { LanguageModelV1 } from 'ai';
import { IAIProvider, AIProviderConfig } from '../types';

export class OpenAIProvider implements IAIProvider {
  private openAIInstance;

  constructor(config: AIProviderConfig) {
    const settings: OpenAIProviderSettings = {
      apiKey: config.apiKey,
    };
    if (config.baseURL) {
      settings.baseURL = config.baseURL;
    }
    if (config.customHeaders) {
      settings.headers = config.customHeaders;
    }
    this.openAIInstance = createOpenAI(settings);
  }

  getModel(modelId: string): LanguageModelV1 {
    return this.openAIInstance(modelId);
  }

  supportsModel(_modelId: string): boolean {
    // 简化处理：OpenAI Provider 可以自由接收任意 modelId (适配类 OpenAI 接口的第三方模型)
    return true;
  }
}
