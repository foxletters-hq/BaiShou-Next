import { TtsProviderRegistry } from './tts.registry'
import { createTtsProviderForId, listRegisteredTtsProviderIds } from './tts-provider-creators'
import type { TtsProvider } from '../types/tts.types'

/**
 * TTS 提供商实例工厂
 * 按供应商 id 创建具体实现，并装配默认注册表
 */
export class TtsProviderFactory {
  static createProviderForId(providerId: string): TtsProvider | undefined {
    return createTtsProviderForId(providerId)
  }
}

let defaultRegistry: TtsProviderRegistry | null = null

/** 创建包含全部内置 TTS 供应商的新注册表 */
export function createDefaultTtsRegistry(): TtsProviderRegistry {
  const registry = new TtsProviderRegistry()
  for (const id of listRegisteredTtsProviderIds()) {
    const provider = createTtsProviderForId(id)
    if (provider) {
      registry.register(provider)
    }
  }
  return registry
}

/** 应用层共享的默认 TTS 注册表（懒加载单例） */
export function getDefaultTtsRegistry(): TtsProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultTtsRegistry()
  }
  return defaultRegistry
}

/** 测试或热重载时重置默认注册表 */
export function resetDefaultTtsRegistry(): void {
  defaultRegistry = null
}
