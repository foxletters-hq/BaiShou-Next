import {
  DEFAULT_LATTE_ASSISTANT_ID,
  getDefaultLatteAssistantSeed,
  isAssistantCustomAvatar,
  isFactoryLatteAssistantSystemPrompt,
  LEGACY_DEFAULT_ASSISTANT_NAMES
} from '@baishou/shared'
import type { AssistantManagerService } from './assistant-manager.service'

function isLegacyDefaultAssistantName(name: string): boolean {
  return (LEGACY_DEFAULT_ASSISTANT_NAMES as readonly string[]).includes(name)
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
 * - 仍为出厂/旧版默认伙伴时，无损升级为当前 Latte
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
    return
  }

  const legacyDefault = assistants.find(
    (a) =>
      a.id === DEFAULT_LATTE_ASSISTANT_ID &&
      a.isDefault &&
      shouldTreatAsFactoryLatteAssistant({ name: a.name, systemPrompt: a.systemPrompt })
  )
  if (legacyDefault) {
    await assistantManager.update(legacyDefault.id, {
      name: seed.name,
      description: seed.description,
      ...(isAssistantCustomAvatar(legacyDefault.avatarPath)
        ? {}
        : { avatarPath: seed.avatarPath }),
      systemPrompt: seed.systemPrompt
    })
  }
}

/** 用户切换 UI 语言时，将出厂 Latte 的提示词与描述同步到对应语言 */
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
  await assistantManager.update(DEFAULT_LATTE_ASSISTANT_ID, {
    name: seed.name,
    description: seed.description,
    ...(isAssistantCustomAvatar(assistant.avatarPath) ? {} : { avatarPath: seed.avatarPath }),
    systemPrompt: seed.systemPrompt
  })
}
