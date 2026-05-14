import { useState, useRef, useEffect, useCallback } from 'react';

export interface PendingAssistantMsg {
  id: string;
  content: string;
  reasoning?: string;
  toolInvocations?: any[];
}

export interface UseChatMessagesParams {
  sessionId: string | undefined;
  isStreaming: boolean;
  streamingText: string;
  streamingReasoning: string;
}

export interface UseChatMessagesResult {
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  hasMore: boolean;
  pendingAssistantMsg: PendingAssistantMsg | null;
  loadMore: () => Promise<void>;
  refreshMessages: (retryCount?: number) => Promise<boolean>;
  optimisticAdd: (text: string, attachments?: any[]) => string;
  optimisticRemove: (optimisticId: string) => void;
  markOptimisticSession: (id: string) => void;
  setStreamSessionId: (id: string | null) => void;
}

/**
 * 消息生命周期管理 Hook
 *
 * 职责：
 * 1. 会话切换时加载历史消息
 * 2. 流式结束时同步 DB 消息（带重试）
 * 3. 乐观 UI 增删
 * 4. 分页加载
 * 5. 跟踪当前流所属会话（streamSessionIdRef）
 *
 * 修复：将会话切换和流结束拆成两个独立 useEffect，消除竞态条件。
 * 原因：旧实现在 isNewSession 分支中调用 resetStream() 导致 isStreaming 被过早
 * 重置为 false，使得真正的流结束事件无法触发消息重新加载。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params;

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pendingAssistantMsg, setPendingAssistantMsg] = useState<PendingAssistantMsg | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const optimisticSessionIdRef = useRef<string | null>(null);
  const streamSessionIdRef = useRef<string | null>(null);

  // ── 带重试的 DB 同步 ──
  // 保护机制：DB 返回空或消息数少于当前已知消息数时，不覆盖（防止乐观消息丢失）
  const refreshMessages = useCallback(async (retryCount = 1): Promise<boolean> => {
    if (!sessionId) return false;
    const currentMsgCount = messages.length;
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const currentCount = Math.max(20, currentMsgCount);
        const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, currentCount, 0);
        if (msgs && msgs.length > 0) {
          // 安全检查：DB 返回的消息数不应少于当前已知消息数（除非当前是首次加载）
          // 这防止了流结束时用不完整的 DB 数据覆盖已有的乐观消息
          if (currentMsgCount > 0 && msgs.length < currentMsgCount - 2) {
            console.warn(`[useChatMessages] DB returned ${msgs.length} msgs but we have ${currentMsgCount}, skipping overwrite (attempt ${attempt + 1})`);
            if (attempt < retryCount - 1) {
              await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
              continue;
            }
            return false;
          }
          setMessages(msgs);
          setHasMore(msgs.length === currentCount);
          return true;
        }
      } catch (e) {
        console.warn('[useChatMessages] refreshMessages attempt', attempt + 1, 'failed:', e);
      }
      if (attempt < retryCount - 1) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
      }
    }
    return false;
  }, [sessionId, messages.length]);

  // ── Effect 1: 会话切换 → 加载消息（不碰流状态）──
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setHasMore(false);
      currentSessionIdRef.current = null;
      setPendingAssistantMsg(null);
      return;
    }

    const isNewSession = currentSessionIdRef.current !== sessionId;
    currentSessionIdRef.current = sessionId;

    if (isNewSession) {
      setPendingAssistantMsg(null);
      // 带重试加载消息（解决分支会话等瞬时空结果问题）
      const loadMessages = async () => {
        const success = await new Promise<boolean>((resolve) => {
          window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, 0).then(msgs => {
            if (msgs && msgs.length > 0) {
              setMessages(msgs);
              setHasMore(msgs.length === 20);
              resolve(true);
            } else {
              resolve(false);
            }
          }).catch(() => resolve(false));
        });
        if (!success) {
          // 首次失败，延迟重试（给 DB 写入留时间）
          for (let retry = 1; retry <= 2; retry++) {
            await new Promise(r => setTimeout(r, 200 * retry));
            const retrySuccess = await new Promise<boolean>((resolve) => {
              window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, 0).then(msgs => {
                if (msgs && msgs.length > 0) {
                  setMessages(msgs);
                  setHasMore(msgs.length === 20);
                  resolve(true);
                } else {
                  resolve(false);
                }
              }).catch(() => resolve(false));
            });
            if (retrySuccess) return;
          }
          // 所有重试都失败，确认空状态
          if (optimisticSessionIdRef.current !== sessionId) {
            setMessages([]);
          }
          setHasMore(false);
        }
      };
      loadMessages();
    }
  }, [sessionId]);

  // ── Effect 2: 流结束 → 同步 DB 消息（独立于会话切换）──
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    // 仅在 isStreaming 从 true→false 的转换瞬间触发
    if (prevStreamingRef.current && !isStreaming && sessionId) {
      // 构造 pending 过渡气泡（仅当流属于当前会话）
      if (streamSessionIdRef.current === sessionId && (streamingText || streamingReasoning)) {
        setPendingAssistantMsg({
          id: `pending-${Date.now()}`,
          content: streamingText,
          reasoning: streamingReasoning || undefined,
        });
      }
      // 带重试的 DB 同步，增加延迟确保 DB 写入完成
      const syncFromDb = async () => {
        // 等待一小段时间，确保主进程的 DB 事务和 flushSessionToDisk 完成
        await new Promise(r => setTimeout(r, 200));
        const success = await refreshMessages(5);
        if (success) {
          setPendingAssistantMsg(null);
        }
      };
      syncFromDb();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, sessionId]);

  // ── 分页加载 ──
  const loadMore = useCallback(async () => {
    if (!sessionId) return;
    try {
      const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, messages.length);
      if (msgs && msgs.length > 0) {
        setMessages(prev => [...msgs, ...prev]);
        setHasMore(msgs.length === 20);
      } else {
        setHasMore(false);
      }
    } catch {
      // 静默失败
    }
  }, [sessionId, messages.length]);

  // ── 乐观 UI ──
  const optimisticAdd = useCallback((text: string, attachments?: any[]): string => {
    const optimisticId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: optimisticId,
      role: 'user',
      content: text,
      attachments,
      createdAt: new Date(),
    }]);
    return optimisticId;
  }, []);

  const optimisticRemove = useCallback((optimisticId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
  }, []);

  // 标记乐观会话（创建新会话后调用，防止 DB 空结果覆盖乐观 UI）
  const markOptimisticSession = useCallback((id: string) => {
    optimisticSessionIdRef.current = id;
  }, []);

  // 设置当前流所属会话 ID
  const setStreamSessionId = useCallback((id: string | null) => {
    streamSessionIdRef.current = id;
  }, []);

  return {
    messages,
    setMessages,
    hasMore,
    pendingAssistantMsg,
    loadMore,
    refreshMessages,
    optimisticAdd,
    optimisticRemove,
    markOptimisticSession,
    setStreamSessionId,
  };
}
