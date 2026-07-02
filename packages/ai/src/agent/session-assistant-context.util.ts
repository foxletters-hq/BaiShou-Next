import { mergeDisabledToolIds, normalizeAssistantKind, type AssistantKind } from '@baishou/shared'

export interface SessionAssistantContext {
  effectiveSystemPrompt?: string
  assistantKind: AssistantKind
  mergedUserConfig: Record<string, unknown>
}

export async function resolveSessionAssistantContext(params: {
  sessionId: string
  sessionRepo: {
    getSessionById?: (id: string) => Promise<{ assistantId?: string } | null>
  }
  assistantRepo?: {
    findById: (
      id: string
    ) => Promise<{ systemPrompt?: string | null; assistantKind?: string | null } | null>
  }
  userConfig: Record<string, unknown>
}): Promise<SessionAssistantContext> {
  const sessionObj = await params.sessionRepo.getSessionById?.(params.sessionId)
  let mergedUserConfig = params.userConfig
  let effectiveSystemPrompt: string | undefined
  let assistantKind: AssistantKind = 'companion'

  if (sessionObj?.assistantId && params.assistantRepo) {
    const ast = await params.assistantRepo.findById(sessionObj.assistantId)
    assistantKind = normalizeAssistantKind(ast?.assistantKind)
    if (ast?.systemPrompt) {
      effectiveSystemPrompt = ast.systemPrompt
    }
    mergedUserConfig = {
      ...params.userConfig,
      disabledToolIds: mergeDisabledToolIds(
        Array.isArray(params.userConfig?.disabledToolIds)
          ? (params.userConfig.disabledToolIds as string[])
          : [],
        assistantKind
      )
    }
  }

  return { effectiveSystemPrompt, assistantKind, mergedUserConfig }
}
