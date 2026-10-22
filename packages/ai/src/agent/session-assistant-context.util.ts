import {
  resolveSessionDisabledToolIds,
  normalizeAssistantKind,
  buildEffectiveAssistantSystemPrompt,
  type AgentSessionKind,
  type AssistantKind
} from '@baishou/shared'
import { AssistantRepository } from '@baishou/database'

export interface SessionAssistantContext {
  effectiveSystemPrompt?: string
  assistantKind: AssistantKind
  mergedUserConfig: Record<string, unknown>
}

export async function resolveSessionAssistantContext(params: {
  sessionId: string
  sessionRepo: {
    getSessionById?: (
      id: string
    ) => Promise<{ assistantId?: string; vaultId?: string; vaultName?: string } | null>
    db?: unknown
    database?: unknown
  }
  assistantRepo?: {
    findById: (
      id: string,
      vaultId?: string | null
    ) => Promise<{
      systemPrompt?: string | null
      customSystemPrompt?: string | null
      assistantKind?: string | null
    } | null>
  }
  userConfig?: Record<string, unknown>
  /** 调用方传入的默认人设（当会话未绑定助手或助手无自定义人设时作为回退） */
  systemPrompt?: string
  /** 工作台会话以工作区策略为准，不追加伙伴类型禁用列表 */
  sessionKind?: AgentSessionKind
  /** 已预取的会话对象，传入时不再重复调用 getSessionById */
  sessionObj?: { assistantId?: string; vaultId?: string; vaultName?: string } | null
}): Promise<SessionAssistantContext> {
  const sessionObj =
    params.sessionObj !== undefined
      ? params.sessionObj
      : await params.sessionRepo.getSessionById?.(params.sessionId)
  let mergedUserConfig = params.userConfig ?? {}
  let effectiveSystemPrompt = params.systemPrompt
  let assistantKind: AssistantKind = 'companion'

  if (sessionObj?.assistantId) {
    const vaultId = String(sessionObj?.vaultId ?? '').trim() || null
    let ast:
      | {
          systemPrompt?: string | null
          customSystemPrompt?: string | null
          assistantKind?: string | null
        }
      | null
      | undefined = null

    if (params.assistantRepo) {
      ast = await params.assistantRepo.findById(sessionObj.assistantId, vaultId)
    } else {
      const db = (params.sessionRepo as any).db || (params.sessionRepo as any).database
      if (db) {
        const astRepo = new AssistantRepository(db, () => vaultId)
        ast = await astRepo.findById(sessionObj.assistantId, vaultId)
      }
    }

    if (ast) {
      assistantKind = normalizeAssistantKind(ast.assistantKind)
      const combined = buildEffectiveAssistantSystemPrompt(ast.systemPrompt, ast.customSystemPrompt)
      if (combined) {
        effectiveSystemPrompt = combined
      }
      mergedUserConfig = {
        ...mergedUserConfig,
        disabledToolIds: resolveSessionDisabledToolIds(
          Array.isArray(mergedUserConfig['disabledToolIds'])
            ? (mergedUserConfig['disabledToolIds'] as string[])
            : [],
          assistantKind,
          params.sessionKind
        )
      }
    }
  }

  return { effectiveSystemPrompt, assistantKind, mergedUserConfig }
}
