import { useState, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAgentStore } from '@baishou/store/stores/agent.store.ts';
import { useBaishou } from '../providers/BaishouProvider';

// Token 统计接口
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalCostMicros: number;
}

export function useAgentStream(
  currentSessionId: string | null,
  currentProviderId: string | null,
  currentModelId: string | null,
  currentAssistant: { id?: string; name?: string } | null,
  onSessionCreated?: (sessionId: string) => void,
) {
  const { t } = useTranslation();
  const { addMessage, updateMessage, setLoading, clearSession, messages } = useAgentStore();
  const { startAgentChat, services } = useBaishou();

  // 流式对话状态
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalCostMicros: 0 });

  // 用于中止请求的 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // 发送消息
  const handleSend = useCallback(async (text: string, attachments?: any[]) => {
    if (!text.trim()) return;

    // 如果没有当前会话，创建新会话
    let sessionId = currentSessionId;
    if (!sessionId && services) {
      try {
        const newSessionId = Date.now().toString();
        await services.sessionManager.upsertSession({
          id: newSessionId,
          title: text.substring(0, 20) || t('agent.sessions.newChat', '新对话'),
          assistantId: currentAssistant?.id,
        });
        sessionId = newSessionId;
        onSessionCreated?.(newSessionId);
      } catch (e) {
        console.error('Failed to create session', e);
        Alert.alert(t('common.error', '错误'), t('agent.sessions.createFailed', '创建会话失败'));
        return;
      }
    }

    if (!sessionId) return;

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    // 添加用户消息
    const userMessageId = Date.now().toString();
    addMessage({ id: userMessageId, role: 'user', content: text, timestamp: new Date(), attachments });

    // 添加助手消息占位
    const assistantMessageId = (Date.now() + 1).toString();
    addMessage({ id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() });
    setLoading(true);
    setIsStreaming(true);
    setStreamingText('');
    setStreamingReasoning('');

    try {
      let currentText = '';
      // 传递助手级模型配置覆盖
      await startAgentChat?.(sessionId, text, {
        onTextDelta: (chunk) => {
          currentText += chunk;
          setStreamingText(currentText);
          updateMessage(assistantMessageId, { content: currentText });
        },
        onReasoningDelta: (chunk) => {
          setStreamingReasoning(prev => prev + chunk);
        },
        onFinish: (result?: any) => {
          setLoading(false);
          setIsStreaming(false);
          abortControllerRef.current = null;
          // 从回调结果中获取真实的 token 统计
          if (result) {
            setTokenUsage(prev => ({
              inputTokens: prev.inputTokens + (result.inputTokens || 0),
              outputTokens: prev.outputTokens + (result.outputTokens || 0),
              totalCostMicros: prev.totalCostMicros + (result.costMicros || 0),
            }));
          }
        },
        onError: (err) => {
          setLoading(false);
          setIsStreaming(false);
          abortControllerRef.current = null;
          const errorMsg = err.message || '';
          let displayMsg = errorMsg;
          if (errorMsg.includes('API key') || errorMsg.includes('apiKey')) {
            displayMsg = t('agent.error.api_key', 'API Key 已过期或无效，请在设置中重新配置。');
          } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
            displayMsg = t('agent.error.rate_limit', '请求过于频繁，请稍后再试。');
          } else if (errorMsg.includes('network') || errorMsg.includes('fetch')) {
            displayMsg = t('agent.error.network', '网络连接失败，请检查网络设置。');
          } else if (errorMsg.includes('timeout')) {
            displayMsg = t('agent.error.timeout', '请求响应超时，请稍后再试。');
          }
          updateMessage(assistantMessageId, { content: currentText + '\n\n[ERR] ' + displayMsg });
        }
      }, { providerId: currentProviderId || undefined, modelId: currentModelId || undefined });
    } catch (e: any) {
      setLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
      updateMessage(assistantMessageId, { content: '[系统错误] ' + e.message });
    }
  }, [currentSessionId, currentAssistant, services, startAgentChat, t, addMessage, updateMessage, setLoading, onSessionCreated]);

  // 停止生成
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setIsStreaming(false);
  }, [setLoading]);

  // 重新生成
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (!currentSessionId || !services) return;
    try {
      // 找到该消息之前的用户消息
      const msgIndex = messages.findIndex(m => m.id === messageId);
      if (msgIndex <= 0) return;

      const userMessage = messages[msgIndex - 1];
      if (userMessage.role !== 'user') return;

      // 删除该消息及之后的所有消息
      clearSession();
      const messagesToKeep = messages.slice(0, msgIndex - 1);
      messagesToKeep.forEach(msg => addMessage(msg));

      // 重新发送
      await handleSend(userMessage.content, userMessage.attachments);
    } catch (e) {
      console.error('Failed to regenerate', e);
    }
  }, [currentSessionId, services, messages, clearSession, addMessage, handleSend]);

  // 编辑消息
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!currentSessionId || !services) return;
    try {
      // 找到该消息，删除之后的消息，重新发送
      const msgIndex = messages.findIndex(m => m.id === messageId);
      if (msgIndex < 0) return;

      // 清除当前会话，保留编辑消息之前的消息
      clearSession();
      const messagesToKeep = messages.slice(0, msgIndex);
      messagesToKeep.forEach(msg => addMessage(msg));

      // 重新发送编辑后的内容
      await handleSend(newContent);
    } catch (e) {
      console.error('Failed to edit message', e);
    }
  }, [currentSessionId, services, messages, clearSession, addMessage, handleSend]);

  // 删除消息
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!currentSessionId || !services) return;
    Alert.alert(
      t('common.confirm_delete', '确认删除'),
      t('agent.messages.deleteConfirm', '您确定要删除这条消息历史吗？此操作不可逆转。'),
      [
        { text: t('common.cancel', '取消'), style: 'cancel' },
        {
          text: t('common.delete', '删除'),
          style: 'destructive',
          onPress: async () => {
            try {
              // 重新加载会话消息（排除删除的消息）
              clearSession();
              const remainingMessages = messages.filter(m => m.id !== messageId);
              remainingMessages.forEach(msg => addMessage(msg));
            } catch (e) {
              console.error('Failed to delete message', e);
            }
          }
        },
      ]
    );
  }, [currentSessionId, services, t, messages, clearSession, addMessage]);

  // 更新 token 统计
  const updateTokenUsage = useCallback((usage: Partial<TokenUsage>) => {
    setTokenUsage(prev => ({
      ...prev,
      ...usage,
    }));
  }, []);

  return {
    // 状态
    isStreaming,
    streamingText,
    streamingReasoning,
    tokenUsage,
    // 方法
    handleSend,
    handleStop,
    handleRegenerate,
    handleEditMessage,
    handleDeleteMessage,
    updateTokenUsage,
  };
}
