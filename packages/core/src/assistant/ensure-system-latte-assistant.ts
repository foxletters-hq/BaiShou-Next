import {
  DEFAULT_LATTE_ASSISTANT_ID,
  SYSTEM_LATTE_ASSISTANT_ID,
  getSystemLatteAssistantSeed,
  isFactoryLatteAssistantSystemPrompt,
  logger
} from '@baishou/shared'
import type { AssistantManagerService } from './assistant-manager.service'

export type EnsureSystemLatteResult = {
  created: boolean
  assistantId: typeof SYSTEM_LATTE_ASSISTANT_ID
}

/**
 * 幂等修复：把本仓仍指向老 default 的会话迁到官方 Latte，并同步写回会话 JSON。
 * 失败返回 null，调用方据此避免在绑定未修好时删除旧伙伴。
 */
async function rebindLegacyDefaultSessions(
  assistantManager: AssistantManagerService,
  vaultId?: string | null
): Promise<string[] | null> {
  try {
    const ids = await assistantManager.rebindSessionsAssistantId(
      DEFAULT_LATTE_ASSISTANT_ID,
      SYSTEM_LATTE_ASSISTANT_ID,
      vaultId
    )
    return Array.isArray(ids) ? ids : []
  } catch (e) {
    logger.warn('[Assistant] 历史会话从 default 迁移到 latte 失败（下次启动重试）:', {
      vaultId: vaultId ?? null,
      error: e instanceof Error ? e.message : String(e)
    })
    return null
  }
}

/**
 * 确保当前工作区存在系统官方伙伴 Latte（id=latte）：
 * - 已存在则幂等返回；用户自定义人设一律保留，仅把可识别的出厂人设升级到当前版本；
 *   同时补一次历史会话自愈（default → latte），修复旧版本只改库未落盘导致的聊天“消失”；
 * - 若存在老版本出厂默认伙伴（id=default），将其平滑升级为官方伙伴（id=latte），
 *   继承用户的全部人设定制、模型、头像与历史会话，并清理旧 default 记录，避免双 Latte 并存；
 * - 缺失且无旧出厂伙伴（新仓）则新建；仅当仓内尚无任何 isDefault 时设为默认。
 *
 * 任何情况下，历史会话的 assistant_id 都会在迁移后同步写回磁盘 JSON，
 * 避免冷启动按磁盘回灌时再次覆盖成 default。
 */
export async function ensureSystemLatteAssistant(
  assistantManager: AssistantManagerService,
  locale?: string,
  vaultId?: string | null
): Promise<EnsureSystemLatteResult> {
  const existing = await assistantManager.findById(SYSTEM_LATTE_ASSISTANT_ID, vaultId)
  if (existing) {
    // 用户自定义人设不动；只升级还能识别为出厂默认的旧人设（例如旧版含应用名的文案）
    if (isFactoryLatteAssistantSystemPrompt(existing.systemPrompt)) {
      const seed = getSystemLatteAssistantSeed(locale)
      if ((existing.systemPrompt ?? '') !== seed.systemPrompt) {
        await assistantManager.update(SYSTEM_LATTE_ASSISTANT_ID, {
          systemPrompt: seed.systemPrompt
        })
      }
    }
    // 旧版本可能已经删掉 default 伙伴、但会话 JSON 仍指向 default；
    // 这里每次启动都做一次幂等修复，保证聊天记录重新挂回 Latte。
    if (typeof assistantManager.syncToDisk === 'function') {
      try {
        await assistantManager.syncToDisk(SYSTEM_LATTE_ASSISTANT_ID)
      } catch (e) {
        logger.warn('[Assistant] Latte 伙伴 JSON 落盘自愈失败（非阻塞）:', {
          vaultId: vaultId ?? null,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    }
    await rebindLegacyDefaultSessions(assistantManager, vaultId)
    return { created: false, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
  }

  // 平滑升级：若存在老版本的 default 伙伴，升级合并为官方 latte 助手
  const legacyDefault = await assistantManager.findById(DEFAULT_LATTE_ASSISTANT_ID, vaultId)
  if (legacyDefault) {
    const seed = getSystemLatteAssistantSeed(locale)
    const legacyPromptIsFactory = isFactoryLatteAssistantSystemPrompt(legacyDefault.systemPrompt)
    await assistantManager.create({
      id: SYSTEM_LATTE_ASSISTANT_ID,
      name: legacyDefault.name || seed.name,
      description: legacyDefault.description || seed.description,
      avatarPath: legacyDefault.avatarPath || seed.avatarPath,
      systemPrompt: legacyPromptIsFactory
        ? seed.systemPrompt
        : legacyDefault.systemPrompt || seed.systemPrompt,
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

    // 先迁移会话（含落盘），成功后再删除旧伙伴；
    // 否则一旦重绑失败，旧伙伴已删、会话又还指向 default，就再也修不回来了。
    const rebound = await rebindLegacyDefaultSessions(assistantManager, vaultId)

    if (rebound !== null) {
      try {
        await assistantManager.delete(DEFAULT_LATTE_ASSISTANT_ID, vaultId)
      } catch (e) {
        logger.warn('[Assistant] 清理旧 default 伙伴失败（非阻塞，下次启动重试）:', {
          vaultId: vaultId ?? null,
          error: e instanceof Error ? e.message : String(e)
        })
      }
    } else {
      logger.warn('[Assistant] 会话绑定迁移失败，暂不删除旧 default 伙伴，避免历史会话失联', {
        vaultId: vaultId ?? null
      })
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

  // 即便本仓没有 default 伙伴，也可能存在指向 default 的孤儿会话（旧版本只改库未落盘）。
  await rebindLegacyDefaultSessions(assistantManager, vaultId)

  return { created: true, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
}
