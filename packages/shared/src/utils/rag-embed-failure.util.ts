import type { RagConfig } from '../types/settings.types'

const MAX_DIARY_EMBED_FAILURE_MESSAGE_CHARS = 500

export function isRagMemoryEnabled(config?: Pick<RagConfig, 'ragEnabled'> | null): boolean {
  return config?.ragEnabled !== false
}

export function hasRagDiaryEmbedFailure(
  config?: Pick<RagConfig, 'lastDiaryEmbedFailureAt'> | null
): boolean {
  return typeof config?.lastDiaryEmbedFailureAt === 'number' && config.lastDiaryEmbedFailureAt > 0
}

export function normalizeDiaryEmbedFailureMessage(message?: string | null): string | undefined {
  const trimmed = message?.trim()
  if (!trimmed) return undefined
  if (trimmed.length <= MAX_DIARY_EMBED_FAILURE_MESSAGE_CHARS) return trimmed
  return `${trimmed.slice(0, MAX_DIARY_EMBED_FAILURE_MESSAGE_CHARS)}…`
}

export function markRagDiaryEmbedFailure<T extends RagConfig>(
  config: T,
  message?: string | null
): T {
  const normalizedMessage = normalizeDiaryEmbedFailureMessage(message)
  return {
    ...config,
    lastDiaryEmbedFailureAt: Date.now(),
    ...(normalizedMessage ? { lastDiaryEmbedFailureMessage: normalizedMessage } : {})
  }
}

export function clearRagDiaryEmbedFailure<T extends RagConfig>(config: T): T {
  const {
    lastDiaryEmbedFailureAt: _removedAt,
    lastDiaryEmbedFailureMessage: _removedMessage,
    ...rest
  } = config
  return rest as T
}
