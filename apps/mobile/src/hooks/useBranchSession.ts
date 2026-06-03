import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { copyBranchCompressionSnapshots } from '@baishou/ai'

export function useBranchSession() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { services } = useBaishou()

  const branchSession = useCallback(
    async (
      sessionId: string,
      messageId: string,
      assistantName?: string
    ): Promise<string | null> => {
      if (!services) {
        toast.showError(t('storage.service_unavailable', '服务未就绪'))
        return null
      }

      try {
        const { sessionManager, snapshotRepo } = services
        if (!snapshotRepo) {
          throw new Error(t('agent.service_not_ready', '服务未就绪'))
        }

        const sessions = await sessionManager.findAllSessions(1000)
        const originalSession = sessions.find((s: any) => s.id === sessionId)
        if (!originalSession) {
          throw new Error(t('agent.sessions.empty', '暂无会话记录...'))
        }

        const allMessages = await sessionManager.getMessagesBySession(sessionId, 9999)

        const targetIndex = allMessages.findIndex((m: any) => m.id === messageId)
        if (targetIndex === -1) {
          throw new Error(t('agent.error.unknown', '出错了：{{msg}}', { msg: messageId }))
        }

        const messagesToCopy = allMessages.slice(0, targetIndex + 1)

        const newSessionId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        const branchTitle = `${assistantName || originalSession.title || t('agent.sessions.default_title', '新对话')} (${t('agent.chat.branch', '从此处创建分支')})`

        await sessionManager.upsertSession({
          id: newSessionId,
          title: branchTitle,
          assistantId: originalSession.assistantId || undefined,
          providerId: originalSession.providerId || 'default',
          modelId: originalSession.modelId || 'default',
          vaultName: originalSession.vaultName || 'default'
        } as any)

        const oldToNewMessageId = new Map<string, string>()
        for (let i = 0; i < messagesToCopy.length; i++) {
          const msg = messagesToCopy[i] as any
          const newMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
          oldToNewMessageId.set(msg.id, newMsgId)
          const originalParts = msg.parts || []

          await sessionManager.insertMessageWithParts(
            {
              id: newMsgId,
              sessionId: newSessionId,
              role: msg.role,
              orderIndex: i + 1,
              inputTokens: msg.inputTokens,
              outputTokens: msg.outputTokens,
              costMicros: msg.costMicros,
              providerId: msg.providerId,
              modelId: msg.modelId
            },
            originalParts.map((p: any) => ({
              id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              messageId: newMsgId,
              sessionId: newSessionId,
              type: p.type,
              data: p.data
            }))
          )
        }

        await copyBranchCompressionSnapshots(
          snapshotRepo,
          sessionId,
          newSessionId,
          oldToNewMessageId,
          messagesToCopy.map((m: { id: string; orderIndex: number }) => ({
            id: m.id,
            orderIndex: m.orderIndex
          }))
        )

        return newSessionId
      } catch (e: any) {
        console.error('[Branch] Error:', e)
        toast.showError(e.message || t('app.unknown_error', '未知网络或系统错误'))
        return null
      }
    },
    [services, t]
  )

  return { branchSession }
}
