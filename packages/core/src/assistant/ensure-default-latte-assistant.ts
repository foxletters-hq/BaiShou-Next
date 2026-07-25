import {
  DEFAULT_LATTE_ASSISTANT_ID,
  getDefaultLatteAssistantSeed,
  isAssistantCustomAvatar,
  isFactoryLatteAssistantSystemPrompt,
  LEGACY_DEFAULT_ASSISTANT_NAMES,
  normalizePersistedAvatarPath
} from '@baishou/shared'
import type { AssistantManagerService } from './assistant-manager.service'

function isLegacyDefaultAssistantName(name: string): boolean {
  return (LEGACY_DEFAULT_ASSISTANT_NAMES as readonly string[]).includes(name)
}

/** findAll 可能返回 local:// 解析结果，统一后再判断是否自定义头像 */
function hasCustomAssistantAvatar(avatarPath: string | null | undefined): boolean {
  return isAssistantCustomAvatar(normalizePersistedAvatarPath(avatarPath) ?? avatarPath)
}

function shouldTreatAsFactoryLatteAssistant(input: {
  name: string
  systemPrompt?: string | null
}): boolean {
  return (
    isLegacyDefaultAssistantName(input.name) ||
    isFactoryLatteAssistantSystemPrompt(input.systemPrompt)
  )
}

function resolveDefaultAssistantId(existingIds: Set<string>): string {
  if (!existingIds.has(DEFAULT_LATTE_ASSISTANT_ID)) return DEFAULT_LATTE_ASSISTANT_ID
  return `latte-${Date.now()}`
}

/**
 * 确保当前工作区存在内置默认伙伴 Latte：
 * - 无伙伴时创建
 * - 有伙伴但无 isDefault 时补建
 * - 不修改已有伙伴的提示词或其他字段
 */
export async function ensureDefaultLatteAssistant(
  assistantManager: AssistantManagerService,
  locale?: string
): Promise<void> {
  const seed = getDefaultLatteAssistantSeed(locale)
  const assistants = await assistantManager.findAll()

  if (assistants.length === 0) {
    await assistantManager.create({ id: DEFAULT_LATTE_ASSISTANT_ID, ...seed })
    return
  }

  const hasDefault = assistants.some((a) => a.isDefault)
  if (!hasDefault) {
    const id = resolveDefaultAssistantId(new Set(assistants.map((a) => a.id)))
    await assistantManager.create({ id, ...seed })
  }
}

/**
 * 用户切换 UI 语言时：仅同步出厂 Latte 的名称 / 描述 / 默认头像。
 * 不修改 systemPrompt（已有提示词一律保留）。
 */
export async function syncDefaultLatteAssistantLocale(
  assistantManager: AssistantManagerService,
  locale?: string
): Promise<void> {
  const assistant = await assistantManager.findById(DEFAULT_LATTE_ASSISTANT_ID)
  if (!assistant?.isDefault) return

  if (
    !shouldTreatAsFactoryLatteAssistant({
      name: assistant.name,
      systemPrompt: assistant.systemPrompt
    })
  ) {
    return
  }

  const seed = getDefaultLatteAssistantSeed(locale)
  const nextName = seed.name
  const nextDescription = seed.description
  const nextAvatar = hasCustomAssistantAvatar(assistant.avatarPath)
    ? undefined
    : seed.avatarPath

  if (
    assistant.name === nextName &&
    (assistant.description ?? '') === (nextDescription ?? '') &&
    (nextAvatar === undefined || assistant.avatarPath === nextAvatar)
  ) {
    return
  }

  await assistantManager.update(DEFAULT_LATTE_ASSISTANT_ID, {
    name: nextName,
    description: nextDescription,
    ...(nextAvatar !== undefined ? { avatarPath: nextAvatar } : {})
  })
}
