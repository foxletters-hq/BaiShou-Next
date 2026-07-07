import type { AssistantKind } from '@baishou/shared'

export interface Assistant {
  id: string
  name: string
  emoji: string
  description?: string
  systemPrompt?: string
  isDefault: boolean
  isPinned: boolean
  providerId?: string
  modelId?: string
  avatarPath?: string
  contextWindow?: number
  compressTokenThreshold?: number
  compressKeepTurns?: number
  compressSystemPrompt?: string | null
  assistantKind?: AssistantKind
  emojiGroupId?: string | null
  createdAt?: number
  lastUsedAt?: number
  useCount?: number
}

export function formatTokens(tokens: number): string {
  if (tokens >= 10000) {
    const w = tokens / 10000
    return `${w % 1 === 0 ? w.toFixed(0) : w.toFixed(1)}w`
  }
  return String(tokens)
}

export function formatKeepTurns(
  t: (key: string, fallback: string) => string,
  count: number
): string {
  return t('agent.assistant.compress_keep_turns_unit', '$count 轮').replace(
    '$count',
    String(Math.round(count))
  )
}
