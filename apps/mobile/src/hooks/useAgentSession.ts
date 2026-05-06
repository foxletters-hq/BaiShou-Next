import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@baishou/store/src/stores/agent.store';
import { useBaishou } from '../providers/BaishouProvider';

// 会话消息接口
interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolInvocations?: any[];
  attachments?: any[];
  inputTokens?: number;
  outputTokens?: number;
  isReasoning?: boolean;
  costMicros?: number;
}

export function useAgentSession() {
  const { t } = useTranslation();
  const { messages, addMessage, clearSession } = useAgentStore();
  const { services } = useBaishou();

  // 会话管理状态
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // 将数据库消息转换为 UI 消息格式
  const mapDbMessageToUI = useCallback((msg: any): SessionMessage => ({
    id: msg.id,
    role: msg.role,
    content: msg.content || '',
    timestamp: new Date(msg.createdAt),
    toolInvocations: msg.toolInvocations,
    attachments: msg.attachments,
    inputTokens: msg.inputTokens,
    outputTokens: msg.outputTokens,
    isReasoning: msg.isReasoning,
    costMicros: msg.costMicros,
  }), []);

  // 加载会话消息
  const loadMessages = useCallback(async (sessionId: string, limit = 20, offset = 0) => {
    if (!services) return;
    try {
      const msgs = await services.sessionManager.getMessagesBySession(sessionId, limit, offset);
      if (msgs && msgs.length > 0) {
        if (offset === 0) {
          clearSession();
        }
        msgs.forEach((msg: any) => addMessage(mapDbMessageToUI(msg)));
        setHasMore(msgs.length === limit);
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  }, [services, clearSession, addMessage, mapDbMessageToUI]);

  // 加载更多消息（使用 offset 分页）
  const handleLoadMore = useCallback(async () => {
    if (!currentSessionId || !services) return;
    try {
      const currentCount = messages.length;
      const msgs = await services.sessionManager.getMessagesBySession(currentSessionId, 20, currentCount);
      if (msgs && msgs.length > 0) {
        msgs.forEach((msg: any) => addMessage(mapDbMessageToUI(msg)));
        setHasMore(msgs.length === 20);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error('Failed to load more messages', e);
    }
  }, [currentSessionId, services, messages, addMessage, mapDbMessageToUI]);

  // 选择会话
  const handleSelectSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    clearSession();
    await loadMessages(sessionId);
  }, [clearSession, loadMessages]);

  // 创建新会话
  const handleCreateSession = useCallback(async () => {
    if (!services) return null;
    try {
      const newId = Date.now().toString();
      await services.sessionManager.upsertSession({
        id: newId,
        title: t('agent.sessions.newChat', '新对话'),
      });
      setCurrentSessionId(newId);
      clearSession();
      return newId;
    } catch (e) {
      console.error('Failed to create session', e);
      Alert.alert(t('common.error', '错误'), t('agent.sessions.createFailed', '创建会话失败'));
      return null;
    }
  }, [services, t, clearSession]);

  // 删除会话
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!services) return;
    try {
      await services.sessionManager.deleteSessions([sessionId]);
      if (sessionId === currentSessionId) {
        setCurrentSessionId(null);
        clearSession();
      }
    } catch (e) {
      console.error('Failed to delete session', e);
      Alert.alert(t('common.error', '错误'), t('agent.sessions.deleteFailed', '删除会话失败'));
    }
  }, [services, t, currentSessionId, clearSession]);

  // 置顶会话
  const handlePinSession = useCallback(async (sessionId: string, isPinned: boolean) => {
    if (!services) return;
    try {
      await services.sessionManager.togglePin(sessionId, !isPinned);
    } catch (e) {
      console.error('Failed to pin session', e);
    }
  }, [services]);

  return {
    // 状态
    currentSessionId,
    setCurrentSessionId,
    hasMore,
    messages,
    // 方法
    loadMessages,
    handleLoadMore,
    handleSelectSession,
    handleCreateSession,
    handleDeleteSession,
    handlePinSession,
  };
}
