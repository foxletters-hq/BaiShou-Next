import { LanguageModel } from 'ai'

export interface AIProviderConfig {
  apiKey: string
  baseURL?: string
  customHeaders?: Record<string, string>
}

export interface IAIProvider {
  /** 初始化并返回底层模型实例（Vercel AI SDK LanguageModel） */
  getModel(modelId: string): LanguageModel

  /** 是否支持某个具体模型 */
  supportsModel(modelId: string): boolean
}
