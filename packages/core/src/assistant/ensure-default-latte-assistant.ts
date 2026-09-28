import {
  SYSTEM_LATTE_ASSISTANT_ID,
  getSystemLatteAssistantSeed,
  isAssistantCustomAvatar,
  isFactoryLatteAssistantSystemPrompt,
  LEGACY_DEFAULT_ASSISTANT_NAMES,
  normalizePersistedAvatarPath
} from '@baishou/shared'
import type { AssistantManagerService } from './assistant-manager.service'
import { ensureSystemLatteAssistant } from './ensure-system-latte-assistant'

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

/**
 * 工作区伙伴 bootstrap：仅确保系统 Latte（id=latte）存在。
 * 不创建、不改写旧的 id=default 或其他已有伙伴。
 */
export async function ensureDefaultLatteAssistant(
  assistantManager: AssistantManagerService,
  locale?: string
): Promise<void> {
  await ensureSystemLatteAssistant(assistantManager, locale)
}

/**
 * 用户切换 UI 语言时：仅同步出厂 Latte 的名称 / 描述 / 默认头像。
 * 不修改 systemPrompt（已有提示词一律保留），也不碰旧 id=default。
 */
export async function syncDefaultLatteAssistantLocale(
  assistantManager: AssistantManagerService,
  locale?: string
): Promise<void> {
  const assistant = await assistantManager.findById(SYSTEM_LATTE_ASSISTANT_ID)
  if (!assistant) return

  if (
    !shouldTreatAsFactoryLatteAssistant({
      name: assistant.name,
      systemPrompt: assistant.systemPrompt
    })
  ) {
    return
  }

  const seed = getSystemLatteAssistantSeed(locale)
  const nextName = seed.name
  const nextDescription = seed.description
  const nextAvatar = hasCustomAssistantAvatar(assistant.avatarPath) ? undefined : seed.avatarPath

  if (
    assistant.name === nextName &&
    (assistant.description ?? '') === (nextDescription ?? '') &&
    (nextAvatar === undefined || assistant.avatarPath === nextAvatar)
  ) {
    return
  }

  await assistantManager.update(SYSTEM_LATTE_ASSISTANT_ID, {
    name: nextName,
    description: nextDescription,
    ...(nextAvatar !== undefined ? { avatarPath: nextAvatar } : {})
  })
}
