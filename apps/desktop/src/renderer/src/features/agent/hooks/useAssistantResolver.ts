import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAssistantStore } from '@baishou/store'
import {
  DEFAULT_LATTE_ASSISTANT_ID,
  LATTE_ASSISTANT_NAME,
  SYSTEM_LATTE_ASSISTANT_ID
} from '@baishou/shared'

export interface UseAssistantResolverParams {
  sessionId: string | undefined
  sessions: any[]
}

export interface UseAssistantResolverResult {
  currentAssistant: any
  activeAssistantId: string | undefined
}

/**
 * 助手解析 Hook
 *
 * 职责：根据当前会话/URL 参数解析出活跃的助手实体
 */
export function useAssistantResolver(
  params: UseAssistantResolverParams
): UseAssistantResolverResult {
  const { sessionId, sessions } = params
  const [searchParams] = useSearchParams()
  const { assistants } = useAssistantStore()

  const currentSession = sessions.find((s: any) => s.id === sessionId)

  const sanitizeAssistantId = (raw: unknown): string | undefined => {
    let val: string | undefined
    if (typeof raw === 'string' && raw.length > 0) val = raw
    else if (raw !== null && raw !== undefined) val = String(raw)
    if (!val) return undefined
    return val === DEFAULT_LATTE_ASSISTANT_ID ? SYSTEM_LATTE_ASSISTANT_ID : val
  }

  let activeAssistantId: string | undefined
  if (!sessionId) {
    activeAssistantId = sanitizeAssistantId(searchParams.get('assistantId'))
  } else if (currentSession) {
    activeAssistantId = sanitizeAssistantId((currentSession as any).assistantId)
  } else {
    // Fallback: if session not found in loaded list, check URL assistantId
    activeAssistantId = sanitizeAssistantId(searchParams.get('assistantId'))
  }

  const currentAssistant = useMemo(() => {
    let assistant: any
    if (activeAssistantId) {
      assistant = assistants.find((a) => String(a.id) === String(activeAssistantId)) ||
        assistants.find((a) => a.isDefault) || {
          id: SYSTEM_LATTE_ASSISTANT_ID,
          name: LATTE_ASSISTANT_NAME
        }
    } else {
      assistant = assistants.find((a) => a.isDefault) || {
        id: SYSTEM_LATTE_ASSISTANT_ID,
        name: LATTE_ASSISTANT_NAME
      }
    }
    return { ...assistant, id: String(assistant.id) }
  }, [activeAssistantId, assistants])

  return { currentAssistant, activeAssistantId }
}
