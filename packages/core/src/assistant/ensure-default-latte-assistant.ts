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

function factoryLatteSeedMatchesAssistant(
  seed: ReturnType<typeof getSystemLatteAssistantSeed>,
  assistant: {
    name: string
    description?: string | null
    systemPrompt?: string | null
    avatarPath?: string | null
  }
): boolean {
  return (
    assistant.name === seed.name &&
    (assistant.description ?? '') === (seed.description ?? '') &&
    (assistant.systemPrompt ?? '') === (seed.systemPrompt ?? '') &&
    (hasCustomAssistantAvatar(assistant.avatarPath) || assistant.avatarPath === seed.avatarPath)
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
 * 用户切换 UI 语言时，若系统 Latte 仍为出厂人设，则同步名称/描述/人设提示词。
 * 不改写 customSystemPrompt，也不碰旧 id=default。
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
  if (factoryLatteSeedMatchesAssistant(seed, assistant)) {
    return
  }
  await assistantManager.update(SYSTEM_LATTE_ASSISTANT_ID, {
    name: seed.name,
    description: seed.description,
    ...(hasCustomAssistantAvatar(assistant.avatarPath) ? {} : { avatarPath: seed.avatarPath }),
    systemPrompt: seed.systemPrompt
  })
}
