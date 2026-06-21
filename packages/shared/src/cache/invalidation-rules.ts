import {
  USER_PROFILE_LEGACY_SETTINGS_KEY,
  USER_PROFILE_SETTINGS_KEY
} from '../constants/user-profile.constants'
import type { CacheKey } from './cache-keys'
import type { DomainMutationEvent } from './domain-mutation.types'
import { mutationRuleKey } from './domain-mutation.types'

const ASSISTANT_SETTINGS_PREFIXES = ['assistant_', 'assistants_'] as const

/** 静态规则：mutationRuleKey → 需失效的 CacheKey 列表；`*` 表示全部 clear */
const INVALIDATION_RULES: Record<string, CacheKey[]> = {
  'diary.create': ['summary.dashboard', 'diary.list'],
  'diary.update': ['summary.dashboard', 'diary.list'],
  'diary.delete': ['summary.dashboard', 'diary.list'],
  'summary.create': ['summary.dashboard', 'summary.gallery'],
  'summary.update': ['summary.dashboard', 'summary.gallery'],
  'summary.delete': ['summary.dashboard', 'summary.gallery'],
  'vault.switch': [],
  'sync.complete': [
    'summary.dashboard',
    'avatar.user',
    'avatar.assistant',
    'mcp.toolContext',
    'diary.list'
  ],
  'sync.resync-complete': ['summary.dashboard', 'diary.list', 'summary.gallery']
}

function isAvatarRelatedSettingsKey(key: unknown): boolean {
  if (typeof key !== 'string') return false
  if (key === USER_PROFILE_SETTINGS_KEY || key === USER_PROFILE_LEGACY_SETTINGS_KEY) {
    return true
  }
  return ASSISTANT_SETTINGS_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/**
 * 根据领域变更事件解析需失效的缓存键。
 * @returns CacheKey 列表，或 `'all'` 表示应 clear 全部注册缓存
 */
export function resolveInvalidatedCacheKeys(event: DomainMutationEvent): CacheKey[] | 'all' {
  if (event.domain === 'vault' && event.action === 'switch') {
    return 'all'
  }

  const ruleKey = mutationRuleKey(event)
  const fromRules = INVALIDATION_RULES[ruleKey]
  if (fromRules) {
    return [...fromRules]
  }

  if (event.domain === 'settings' && event.action === 'update') {
    const settingsKey = event.meta?.key
    if (isAvatarRelatedSettingsKey(settingsKey)) {
      return ['avatar.user', 'avatar.assistant']
    }
    if (settingsKey === 'tts_settings' || settingsKey === 'tts_config') {
      return ['tts.synthesis']
    }
  }

  return []
}

export function applyCacheInvalidation(
  event: DomainMutationEvent,
  registry: {
    invalidate(keys: Iterable<CacheKey>, reason?: string): void
    clearAll(reason?: string): void
  }
): void {
  const keys = resolveInvalidatedCacheKeys(event)
  const reason = event.reason ?? mutationRuleKey(event)
  if (keys === 'all') {
    registry.clearAll(reason)
    return
  }
  if (keys.length > 0) {
    registry.invalidate(keys, reason)
  }
}
