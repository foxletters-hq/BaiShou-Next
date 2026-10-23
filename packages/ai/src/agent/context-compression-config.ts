import type { SessionRepository } from '@baishou/database'
import { AssistantRepository } from '@baishou/database'
import {
  DEFAULT_LATTE_ASSISTANT_ID,
  DEFAULT_MODEL_CONTEXT_WINDOW,
  getModelContextWindow
} from '@baishou/shared'
import type { SessionCompressionConfig } from './context-compression.types'

export { DEFAULT_MODEL_CONTEXT_WINDOW, getModelContextWindow }

const MIN_PRESERVE_RECENT_TOKENS = 2_000
const MAX_PRESERVE_RECENT_TOKENS = 8_000

export function preserveRecentTokenBudget(config: SessionCompressionConfig): number {
  if (config.preserveRecentTokens != null && config.preserveRecentTokens > 0) {
    return config.preserveRecentTokens
  }
  const usable = usableContextTokens(
    config.modelContextWindow ?? DEFAULT_MODEL_CONTEXT_WINDOW,
    config.reservedTokens
  )
  if (usable <= 0) return MAX_PRESERVE_RECENT_TOKENS
  return Math.min(
    MAX_PRESERVE_RECENT_TOKENS,
    Math.max(MIN_PRESERVE_RECENT_TOKENS, Math.floor(usable * 0.25))
  )
}

/** 从伙伴记录读取压缩阈值；无效值视为 0（关闭） */
export function readCompressTokenThreshold(
  assistant: { compressTokenThreshold?: number | null } | null | undefined
): number {
  const raw = assistant?.compressTokenThreshold
  if (raw == null) return 0
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** 为压缩调用预留的 token（输出 + 系统提示 + 工具）：窗口的 20%，夹在 8k–40k */
export function reservedTokensFor(window: number): number {
  if (window <= 0) return 0
  return Math.min(40_000, Math.max(8_000, Math.floor(window * 0.2)))
}

/** 可用上下文 token：window - reserved */
export function usableContextTokens(window: number, reserved?: number): number {
  if (window <= 0) return 0
  const r = reserved ?? reservedTokensFor(window)
  return Math.max(0, window - r)
}

/**
 * 自动压缩触发判定。
 * - 用户显式阈值优先，避免模型窗口识别偏保守时绕过用户设置。
 * - 阈值为 0 表示关闭自动压缩；仅 force 可强制触发。
 * - 没有显式阈值时，模型可用窗口才作为防溢出兜底。
 */
export function resolveCompressionTrigger(
  currentContextTokens: number,
  config: SessionCompressionConfig
): boolean {
  if (config.force) return true

  if (config.threshold > 0) {
    return currentContextTokens > config.threshold
  }

  if (config.threshold === 0) {
    return false
  }

  const usable = usableContextTokens(config.modelContextWindow ?? 0, config.reservedTokens)
  return usable > 0 ? currentContextTokens > usable : false
}

export async function resolveSessionCompressionConfig(
  sessionId: string,
  sessionRepo: SessionRepository
): Promise<SessionCompressionConfig> {
  try {
    const session = await sessionRepo.getSessionById?.(sessionId)
    const vaultId = String(session?.vaultId ?? '').trim() || null
    const astRepo = new AssistantRepository(sessionRepo.db, () => vaultId)

    const linkedAssistantId = session?.assistantId?.trim()
    let ast = linkedAssistantId ? await astRepo.findById(linkedAssistantId, vaultId) : null
    if (!ast) {
      ast = await astRepo.findById(DEFAULT_LATTE_ASSISTANT_ID, vaultId)
    }

    const modelContextWindow = getModelContextWindow(
      session?.modelId,
      ast?.compressModelContextWindow ?? null
    )
    const reserved = reservedTokensFor(modelContextWindow)
    const preserveRecentTokens =
      ast?.compressPreserveRecentTokens != null && ast.compressPreserveRecentTokens > 0
        ? ast.compressPreserveRecentTokens
        : undefined

    return {
      threshold: readCompressTokenThreshold(ast),
      keepTurns: ast?.compressKeepTurns ?? 3,
      systemPrompt: ast?.compressSystemPrompt?.trim() || undefined,
      modelContextWindow,
      reservedTokens: reserved,
      preserveRecentTokens
    }
  } catch {
    const modelContextWindow = DEFAULT_MODEL_CONTEXT_WINDOW
    return {
      threshold: 0,
      keepTurns: 3,
      modelContextWindow,
      reservedTokens: reservedTokensFor(modelContextWindow)
    }
  }
}
