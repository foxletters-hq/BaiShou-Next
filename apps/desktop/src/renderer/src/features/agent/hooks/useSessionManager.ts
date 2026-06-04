import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@baishou/ui'

export interface UseSessionManagerParams {
  currentAssistantId: string | undefined
  loadSessions?: (reset: boolean) => void
}

export interface UseSessionManagerResult {
  createSession: (title: string) => Promise<string | null>
}

/**
 * 会话管理 Hook
 *
 * 职责：仅负责创建会话并返回 ID（不导航、不刷新侧边栏）。
 * 导航、侧边栏刷新均由调用方（AgentScreen.handleSend）在消息落盘后统一控制，
 * 确保 DB 已有完整数据，Effect 1 触发时不会出现空 DB 覆盖乐观 UI 的问题。
 */
export function useSessionManager(params: UseSessionManagerParams): UseSessionManagerResult {
  const { currentAssistantId } = params
  const [searchParams] = useSearchParams()
  const { t } = useTranslation()
  const toast = useToast()

  const createSession = useCallback(
    async (title: string): Promise<string | null> => {
      if (typeof window === 'undefined' || !window.electron) return null
      try {
        const rawAstId = searchParams.get('assistantId') || currentAssistantId || 'default'
        const astId = typeof rawAstId === 'string' ? rawAstId : String(rawAstId)
        const newTitle = title.trim().substring(0, 10) || t('agent.sessions.newChat', '新对话')

        const newId = crypto.randomUUID() // 前端生成纯 UUID

        await window.electron.ipcRenderer.invoke('agent:create-session', {
          id: newId, // 把生成的 ID 传给主进程
          assistantId: astId,
          title: newTitle
        })

        return newId
      } catch (e: any) {
        console.error('[useSessionManager] Create session failed:', e)
        const errMsg = e?.message || e
        toast.showError(
          t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg: errMsg })
        )
        return null
      }
    },
    [searchParams, currentAssistantId, t, toast]
  )

  return { createSession }
}
