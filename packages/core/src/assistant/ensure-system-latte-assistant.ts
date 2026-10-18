import {
  DEFAULT_LATTE_ASSISTANT_ID,
  SYSTEM_LATTE_ASSISTANT_ID,
  getSystemLatteAssistantSeed
} from '@baishou/shared'
import type { AssistantManagerService } from './assistant-manager.service'

export type EnsureSystemLatteResult = {
  created: boolean
  assistantId: typeof SYSTEM_LATTE_ASSISTANT_ID
}

/**
 * 确保当前工作区存在系统官方伙伴 Latte（id=latte）：
 * - 已存在则幂等返回，绝不改写；
 * - 若存在老版本出厂默认伙伴（id=default），将其平滑升级为官方伙伴（id=latte），
 *   继承用户的全部人设定制、模型、头像与历史会话，并清理旧 default 记录，避免双 Latte 并存；
 * - 缺失且无旧出厂伙伴（新仓）则新建；仅当仓内尚无任何 isDefault 时设为默认。
 */
export async function ensureSystemLatteAssistant(
  assistantManager: AssistantManagerService,
  locale?: string,
  vaultId?: string | null
): Promise<EnsureSystemLatteResult> {
  const existing = await assistantManager.findById(SYSTEM_LATTE_ASSISTANT_ID, vaultId)
  if (existing) {
    return { created: false, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
  }

  // 平滑升级：若存在老版本的 default 伙伴，升级合并为官方 latte 助手
  const legacyDefault = await assistantManager.findById(DEFAULT_LATTE_ASSISTANT_ID, vaultId)
  if (legacyDefault) {
    const seed = getSystemLatteAssistantSeed(locale)
    await assistantManager.create({
      id: SYSTEM_LATTE_ASSISTANT_ID,
      name: legacyDefault.name || seed.name,
      description: legacyDefault.description || seed.description,
      avatarPath: legacyDefault.avatarPath || seed.avatarPath,
      systemPrompt: legacyDefault.systemPrompt || seed.systemPrompt,
      customSystemPrompt: legacyDefault.customSystemPrompt ?? '',
      isDefault: legacyDefault.isDefault ?? true,
      isPinned: legacyDefault.isPinned ?? false,
      contextWindow: legacyDefault.contextWindow ?? seed.contextWindow,
      compressTokenThreshold: legacyDefault.compressTokenThreshold ?? seed.compressTokenThreshold,
      compressKeepTurns: legacyDefault.compressKeepTurns,
      compressModelContextWindow: legacyDefault.compressModelContextWindow,
      compressPreserveRecentTokens: legacyDefault.compressPreserveRecentTokens,
      compressSystemPrompt: legacyDefault.compressSystemPrompt,
      providerId: legacyDefault.providerId,
      modelId: legacyDefault.modelId,
      emoji: legacyDefault.emoji ?? undefined,
      emojiGroupId: legacyDefault.emojiGroupId,
      emojiEnabled: legacyDefault.emojiEnabled,
      emojiGroupIds: legacyDefault.emojiGroupIds,
      sortOrder: legacyDefault.sortOrder ?? 0,
      assistantKind: 'companion',
      ...(vaultId ? { vaultId } : {})
    })

    try {
      await assistantManager.delete(DEFAULT_LATTE_ASSISTANT_ID, vaultId)
    } catch {
      // best-effort
    }

    if (typeof (assistantManager as any).rebindSessionsAssistantId === 'function') {
      try {
        await (assistantManager as any).rebindSessionsAssistantId(
          DEFAULT_LATTE_ASSISTANT_ID,
          SYSTEM_LATTE_ASSISTANT_ID,
          vaultId
        )
      } catch {
        // best-effort
      }
    }

    return { created: true, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
  }

  const assistants = await assistantManager.findAll()
  const hasDefault = assistants.some((a) => a.isDefault)
  const seed = getSystemLatteAssistantSeed(locale)

  await assistantManager.create({
    id: SYSTEM_LATTE_ASSISTANT_ID,
    ...seed,
    isDefault: !hasDefault,
    ...(vaultId ? { vaultId } : {})
  })

  return { created: true, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
}
