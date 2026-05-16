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
  addUserMessage: (id: string, text: string, attachments?: any[]) => void;
  optimisticRemove: (optimisticId: string) => void;
  setStreamSessionId: (id: string | null) => void;
}

/**
 * 消息生命周期管理 Hook (去乐观化版本)
 * 所有的状态更新均建立在数据库真实数据之上。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params;

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pendingAssistantMsg, setPendingAssistantMsg] = useState<PendingAssistantMsg | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const streamSessionIdRef = useRef<string | null>(null);
  
  const messagesRef = useRef<any[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── 核心：从数据库同步最新消息 ──
  const refreshMessages = useCallback(async (retryCount = 1, overrideSessionId?: string): Promise<boolean> => {
    const targetId = overrideSessionId || sessionId;
    if (!targetId) return false;
    
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        // 实打实去数据库查当前会话的所有（或最近）消息
        // 我们根据当前 state 长度决定拉多少，确保 UI 能够衔接上
        const currentMsgCount = messagesRef.current.length;
        const fetchLimit = Math.max(50, currentMsgCount);
        
        const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', targetId, fetchLimit, 0);

        if (msgs) {
          // 直接使用数据库的最权威数据覆盖 state
          setMessages(msgs);
          setHasMore(msgs.length === fetchLimit);
          return true;
        }
      } catch (e) {
        console.warn('[useChatMessages] refreshMessages attempt', attempt + 1, 'failed:', e);
      }
      if (attempt < retryCount - 1) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
      }
    }
    return false;
  }, [sessionId]);

  // ── Effect 1: 会话切换 → 始终从数据库加载历史 ──
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setHasMore(false);
      currentSessionIdRef.current = null;
      setPendingAssistantMsg(null);
      return;
    }

    if (sessionId !== currentSessionIdRef.current) {
      currentSessionIdRef.current = sessionId;
      
      // 不管是不是新会话，不管 ID 是什么格式，一律从数据库加载
      const loadMessages = async () => {
        try {
          const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 50, 0);
          if (msgs) {
            setMessages(msgs);
            setHasMore(msgs.length === 50);
          }
        } catch (e) {
          console.error('[useChatMessages] DB fetch error:', e);
          setMessages([]);
        }
      };
      loadMessages();
    }
  }, [sessionId]);

  // ── Effect 2: AI 回复结束 → 同步数据库 ──
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && sessionId) {
      // 流结束瞬间，如果产生了内容，先放进 pending 气泡防止视觉闪烁
      if (streamSessionIdRef.current === sessionId && (streamingText || streamingReasoning)) {
        setPendingAssistantMsg({
          id: `pending-${Date.now()}`,
          content: streamingText,
          reasoning: streamingReasoning || undefined,
        });
      }
      
      // 然后实打实地同步数据库消息
      const sync = async () => {
        await new Promise(r => setTimeout(r, 100)); // 给主进程落盘留出极小间隙
        const success = await refreshMessages(5); // 增加重试次数确保拿到刚落盘的数据
        if (success) {
          setPendingAssistantMsg(null); // 同步成功后，才撤掉 pending 气泡
        } else {
          // 如果多次重试都没拿到（可能 AI 没回复成功），也清除气泡
          setPendingAssistantMsg(null);
        }
      };
      sync();
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, sessionId, streamingText, streamingReasoning, refreshMessages]);

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

  // ── 外部接口 ──
  const optimisticRemove = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

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
    optimisticRemove,
    setStreamSessionId,
  };
}
