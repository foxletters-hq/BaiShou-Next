import type { AiProviderModel } from '@baishou/shared'
import type { IAIProvider } from './provider.interface'
import { OpenAIAdaptedProvider } from './openai.provider'
import { GeminiAdaptedProvider } from './gemini.provider'
import { AnthropicAdaptedProvider } from './anthropic.provider'
import { OpenCodeGoAdaptedProvider } from './opencodego/opencodego.provider'

export type ProviderCreator = (config: AiProviderModel) => IAIProvider

/** 遵循 OpenAI API 规范的提供商类型 */
const OPENAI_COMPAT_TYPES = new Set(['openai', 'lmstudio', 'ollama', 'custom'])

const specializedCreators = new Map<string, ProviderCreator>([
  ['gemini', (config) => new GeminiAdaptedProvider(config)],
  ['anthropic', (config) => new AnthropicAdaptedProvider(config)],
  ['opencodego', (config) => new OpenCodeGoAdaptedProvider(config)]
])

/**
 * 注册专用 Provider 构造器（OCP：扩展时不修改工厂主逻辑）
 */
export function registerProviderCreator(type: string, creator: ProviderCreator): void {
  specializedCreators.set(type.toLowerCase(), creator)
}

export function createProviderForType(config: AiProviderModel): IAIProvider {
  const type = config.type.toLowerCase()
  if (OPENAI_COMPAT_TYPES.has(type)) {
    return new OpenAIAdaptedProvider(config)
  }
  const specialized = specializedCreators.get(type)
  if (specialized) {
    return specialized(config)
  }
  return new OpenAIAdaptedProvider(config)
}
