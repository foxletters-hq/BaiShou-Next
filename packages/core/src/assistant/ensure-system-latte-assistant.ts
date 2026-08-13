import {
  SYSTEM_LATTE_ASSISTANT_ID,
  getSystemLatteAssistantSeed
} from '@baishou/shared'
import type { AssistantManagerService } from './assistant-manager.service'

export type EnsureSystemLatteResult = {
  created: boolean
  assistantId: typeof SYSTEM_LATTE_ASSISTANT_ID
}

/**
 * 确保当前工作区存在系统特殊伙伴 Latte（id=latte）：
 * - 已存在则幂等返回，绝不改写
 * - 缺失则新建；仅当仓内尚无任何 isDefault 时设为默认
 */
export async function ensureSystemLatteAssistant(
  assistantManager: AssistantManagerService,
  locale?: string
): Promise<EnsureSystemLatteResult> {
  const existing = await assistantManager.findById(SYSTEM_LATTE_ASSISTANT_ID)
  if (existing) {
    return { created: false, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
  }

  const assistants = await assistantManager.findAll()
  const hasDefault = assistants.some((a) => a.isDefault)
  const seed = getSystemLatteAssistantSeed(locale)

  await assistantManager.create({
    id: SYSTEM_LATTE_ASSISTANT_ID,
    ...seed,
    isDefault: !hasDefault
  })

  return { created: true, assistantId: SYSTEM_LATTE_ASSISTANT_ID }
}
