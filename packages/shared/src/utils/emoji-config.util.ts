import type { EmojiGroup, EmojiItem, EmojiToolConfig } from '../types/settings.types'

export const DEFAULT_EMOJI_GROUP_ID = 'default'

export type AssistantEmojiPrefs = {
  /** 伙伴是否启用表情包（默认关闭） */
  emojiEnabled?: boolean | null
  /** 伙伴可用的表情包组 ID 列表 */
  emojiGroupIds?: string[] | null
  /** @deprecated 旧版单组绑定 */
  emojiGroupId?: string | null
}

export type ResolvedAssistantEmojiConfig = {
  enabled: boolean
  emojis: EmojiItem[]
  groupIds?: string[]
  groupName?: string
}

/** normalizeEmojiToolConfig 的返回值，groups 始终存在 */
export type NormalizedEmojiToolConfig = EmojiToolConfig & { groups: EmojiGroup[] }

function createEmojiGroupId(): string {
  return `emoji_group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 将旧版扁平 emojis 迁移为分组结构 */
export function normalizeEmojiToolConfig(
  config?: EmojiToolConfig | null
): NormalizedEmojiToolConfig {
  const enabled = config?.enabled === true

  if (config?.groups && config.groups.length > 0) {
    return {
      enabled,
      groups: config.groups.map((group) => ({
        id: group.id,
        name: group.name?.trim() || '未命名组',
        emojis: Array.isArray(group.emojis) ? [...group.emojis] : []
      }))
    }
  }

  const legacyEmojis = Array.isArray(config?.emojis) ? config!.emojis : []
  return {
    enabled,
    groups: legacyEmojis.length
      ? [
          {
            id: DEFAULT_EMOJI_GROUP_ID,
            name: '默认组',
            emojis: legacyEmojis
          }
        ]
      : []
  }
}

export function createEmojiGroup(name: string): EmojiGroup {
  return {
    id: createEmojiGroupId(),
    name: name.trim() || '未命名组',
    emojis: []
  }
}

export function isEmojiGroupNameTaken(
  config: EmojiToolConfig,
  name: string,
  excludeGroupId?: string
): boolean {
  const normalized = normalizeEmojiToolConfig(config)
  const target = name.trim().toLowerCase()
  if (!target) return false
  return normalized.groups.some(
    (group) => group.id !== excludeGroupId && group.name.trim().toLowerCase() === target
  )
}

export function upsertEmojiGroup(config: EmojiToolConfig, group: EmojiGroup): EmojiToolConfig {
  const normalized = normalizeEmojiToolConfig(config)
  const groups = normalized.groups.some((item) => item.id === group.id)
    ? normalized.groups.map((item) => (item.id === group.id ? group : item))
    : [...normalized.groups, group]
  return { ...normalized, groups }
}

export function removeEmojiGroup(config: EmojiToolConfig, groupId: string): EmojiToolConfig {
  const normalized = normalizeEmojiToolConfig(config)
  return {
    ...normalized,
    groups: normalized.groups.filter((group) => group.id !== groupId)
  }
}

export function findEmojiGroup(
  config: EmojiToolConfig | undefined | null,
  groupId?: string | null
): EmojiGroup | undefined {
  const normalized = normalizeEmojiToolConfig(config)
  if (normalized.groups.length === 0) return undefined
  if (groupId) {
    return normalized.groups.find((group) => group.id === groupId) ?? normalized.groups[0]
  }
  return normalized.groups[0]
}

export function parseAssistantEmojiGroupIds(
  raw: string | null | undefined,
  legacyGroupId?: string | null
): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
      }
    } catch {
      // ignore
    }
  }
  if (legacyGroupId) return [legacyGroupId]
  return []
}

export function serializeAssistantEmojiGroupIds(ids: string[] | null | undefined): string | null {
  const list = Array.from(new Set((ids ?? []).filter(Boolean)))
  return list.length > 0 ? JSON.stringify(list) : null
}

export function normalizeAssistantEmojiPrefs(prefs?: AssistantEmojiPrefs | null): {
  emojiEnabled: boolean
  emojiGroupIds: string[]
} {
  const emojiEnabled = prefs?.emojiEnabled === true
  if (prefs?.emojiGroupIds && prefs.emojiGroupIds.length > 0) {
    return { emojiEnabled, emojiGroupIds: [...prefs.emojiGroupIds] }
  }
  if (prefs?.emojiGroupId) {
    return { emojiEnabled, emojiGroupIds: [prefs.emojiGroupId] }
  }
  return { emojiEnabled, emojiGroupIds: [] }
}

function mergeEmojiItemsFromGroups(config: EmojiToolConfig, groupIds: string[]): EmojiItem[] {
  const normalized = normalizeEmojiToolConfig(config)
  const seen = new Set<string>()
  const merged: EmojiItem[] = []

  for (const groupId of groupIds) {
    const group = normalized.groups.find((item) => item.id === groupId)
    if (!group?.emojis) continue
    for (const emoji of group.emojis) {
      if (seen.has(emoji.id)) continue
      seen.add(emoji.id)
      merged.push(emoji)
    }
  }

  return merged
}

/** 按全局配置 + 伙伴绑定解析运行时表情包（供 emoji_send 与 UI 预览） */
export function resolveAssistantEmojiConfig(
  config: EmojiToolConfig | undefined | null,
  prefs?: AssistantEmojiPrefs | null
): ResolvedAssistantEmojiConfig {
  const normalized = normalizeEmojiToolConfig(config)
  if (!normalized.enabled) {
    return { enabled: false, emojis: [] }
  }

  const { emojiEnabled, emojiGroupIds } = normalizeAssistantEmojiPrefs(prefs)
  if (!emojiEnabled) {
    return { enabled: false, emojis: [] }
  }

  if (emojiGroupIds.length === 0) {
    return { enabled: true, emojis: [] }
  }

  const emojis = mergeEmojiItemsFromGroups(normalized, emojiGroupIds)
  const names = emojiGroupIds
    .map((id) => normalized.groups.find((group) => group.id === id)?.name)
    .filter(Boolean)

  return {
    enabled: true,
    emojis,
    groupIds: emojiGroupIds,
    groupName: names.length > 0 ? names.join('、') : undefined
  }
}

export function assistantRowToEmojiPrefs(assistant: {
  emojiEnabled?: boolean | null
  emojiGroupIds?: string | null
  emojiGroupId?: string | null
}): AssistantEmojiPrefs {
  return {
    emojiEnabled: assistant.emojiEnabled === true,
    emojiGroupIds: parseAssistantEmojiGroupIds(assistant.emojiGroupIds, assistant.emojiGroupId)
  }
}

/** @deprecated 使用 AssistantEmojiPrefs 参数 */
export function resolveAssistantEmojiConfigLegacy(
  config: EmojiToolConfig | undefined | null,
  emojiGroupId?: string | null
): ResolvedAssistantEmojiConfig {
  return resolveAssistantEmojiConfig(config, { emojiEnabled: true, emojiGroupId })
}
