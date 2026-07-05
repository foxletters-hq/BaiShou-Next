import { normalizeEmojiToolConfig, type EmojiToolConfig } from '@baishou/shared'

const DEFAULT_EMOJI_CONFIG = normalizeEmojiToolConfig({ enabled: false, groups: [] })

type EmojiConfigListener = (config: EmojiToolConfig) => void

let sharedEmojiConfig: EmojiToolConfig = DEFAULT_EMOJI_CONFIG
const emojiConfigListeners = new Set<EmojiConfigListener>()

export function getSharedEmojiToolConfig(): EmojiToolConfig {
  return sharedEmojiConfig
}

export function subscribeEmojiToolConfig(listener: EmojiConfigListener): () => void {
  emojiConfigListeners.add(listener)
  listener(sharedEmojiConfig)
  return () => {
    emojiConfigListeners.delete(listener)
  }
}

export function publishEmojiToolConfig(config: EmojiToolConfig): void {
  sharedEmojiConfig = normalizeEmojiToolConfig(config)
  for (const listener of emojiConfigListeners) {
    listener(sharedEmojiConfig)
  }
}
