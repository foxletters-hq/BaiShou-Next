import type { RagConfig } from '../types/settings.types'

export function hasRagDiaryEmbedFailure(config?: Pick<RagConfig, 'lastDiaryEmbedFailureAt'> | null): boolean {
  return typeof config?.lastDiaryEmbedFailureAt === 'number' && config.lastDiaryEmbedFailureAt > 0
}

export function markRagDiaryEmbedFailure<T extends RagConfig>(config: T): T {
  return {
    ...config,
    lastDiaryEmbedFailureAt: Date.now()
  }
}

export function clearRagDiaryEmbedFailure<T extends RagConfig>(config: T): T {
  const { lastDiaryEmbedFailureAt: _removed, ...rest } = config
  return rest as T
}
