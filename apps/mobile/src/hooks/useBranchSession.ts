import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useBaishou } from '../providers/BaishouProvider';

export function useBranchSession() {
  const { t } = useTranslation();
  const { services } = useBaishou();

  const branchSession = useCallback(async (sessionId: string, messageId: string, assistantName?: string): Promise<string | null> => {
    if (!services) {
      Alert.alert(t('common.error', '错误'), t('agent.service_not_ready', '服务未就绪'));
      return null;
    }

    try {
      const { sessionManager } = services;

      // 1. 获取原会话信息
      const sessions = await sessionManager.findAllSessions(1000);
      const originalSession = sessions.find((s: any) => s.id === sessionId);
      if (!originalSession) {
        throw new Error(t('agent.session_not_found', '原会话不存在'));
      }

      // 2. 获取原会话的所有消息（含 parts）
      const allMessages = await sessionManager.getMessagesBySession(sessionId, 9999);

      // 3. 找到目标消息的位置
      const targetIndex = allMessages.findIndex((m: any) => m.id === messageId);
      if (targetIndex === -1) {
        throw new Error(t('agent.message_not_found', '目标消息不存在'));
      }

      // 4. 截取到目标消息（包含目标消息）
      const messagesToCopy = allMessages.slice(0, targetIndex + 1);

      // 5. 创建新会话
      const newSessionId = `branch-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const branchTitle = `${assistantName || originalSession.title || t('agent.default_name', '对话')} (${t('agent.chat.branch', '分支')})`;

      await sessionManager.upsertSession({
        id: newSessionId,
        title: branchTitle,
        assistantId: originalSession.assistantId || undefined,
        providerId: originalSession.providerId || 'default',
        modelId: originalSession.modelId || 'default',
        vaultName: originalSession.vaultName || 'default',
      } as any);

      // 6. 复制消息到新会话
      for (let i = 0; i < messagesToCopy.length; i++) {
        const msg = messagesToCopy[i] as any;
        const newMsgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

        // 获取原始消息的 parts
        const originalParts = msg.parts || [];

        // 插入消息
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
            modelId: msg.modelId,
          },
          originalParts.map((p: any) => ({
            id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            messageId: newMsgId,
            sessionId: newSessionId,
            type: p.type,
            data: p.data,
          }))
        );
      }

      return newSessionId;
    } catch (e: any) {
      console.error('[Branch] Error:', e);
      Alert.alert(t('agent.chat.branch_failed', '分支创建失败'), e.message || 'Unknown error');
      return null;
    }
  }, [services, t]);

  return { branchSession };
}
