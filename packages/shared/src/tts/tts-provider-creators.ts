import type { TtsProvider } from '../types/tts.types'
import { OpenAiTtsProvider } from './openai-tts.provider'
import { MimoTtsProvider } from './mimo-tts.provider'
import { CloneTtsProvider } from './clone-tts.provider'
import { GptSovitsProvider } from './gpt-sovits.provider'

export type TtsProviderCreator = () => TtsProvider

const builtinCreators = new Map<string, TtsProviderCreator>([
  ['openai-tts', () => new OpenAiTtsProvider()],
  ['mimo-tts', () => new MimoTtsProvider()],
  ['clone-tts', () => new CloneTtsProvider()],
  ['gpt-sovits', () => new GptSovitsProvider()]
])

/**
 * 注册 TTS Provider 构造器（OCP：扩展时不修改工厂主逻辑）
 */
export function registerTtsProviderCreator(id: string, creator: TtsProviderCreator): void {
  builtinCreators.set(id, creator)
}

export function createTtsProviderForId(id: string): TtsProvider | undefined {
  const creator = builtinCreators.get(id)
  return creator?.()
}

export function listRegisteredTtsProviderIds(): string[] {
  return Array.from(builtinCreators.keys())
}
