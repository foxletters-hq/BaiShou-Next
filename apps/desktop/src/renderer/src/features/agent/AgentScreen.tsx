import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { 
  ChatBubble, 
  StreamingBubble, 
  InputBar, 
  TokenBadge,
  ModelSwitcherPopup,
  ChatCostDialog,
  ContextChainDialog,
  AssistantPickerSheet,
  PromptShortcutSheet,
  ShortcutManagerDialog,
  RecallDialog,
  Modal,
  AgentToolsView,
  useDialog,
  toast
} from '@baishou/ui';
import type { InputBarRef } from '@baishou/ui';
import { useSettingsStore, useAssistantStore, usePromptShortcutStore, useUserProfileStore, useAgentStore } from '@baishou/store';
import type { RecallItem } from '@baishou/ui';
import styles from './AgentScreen.module.css';
import { useAgentStream } from './hooks/useAgentStream';
import { useTranslation } from 'react-i18next';
import { MdAutoAwesome } from 'react-icons/md';


export const AgentScreen: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dialog = useDialog();
  const { sessions, loadSessions } = useOutletContext<{ sessions: any[], loadSessions?: (reset: boolean) => void }>() || { sessions: [] };
  const currentSession = sessions.find((s: any) => s.id === sessionId);
  
  // =====================================
  // 接入军火级底层通道
  // =====================================
  const {
    text: streamingText,
    reasoning: streamingReasoning,
    activeTool,
    isStreaming,
    startChat,
    resendChat,
    reset: resetStream,
    error: streamError
  } = useAgentStream();

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const searchMode = useAgentStore(s => s.searchMode);
  const setSearchMode = useAgentStore(s => s.setSearchMode);
  const toggleSearchMode = useAgentStore(s => s.toggleSearchMode);
  const currentSessionIdRef = useRef<string | null>(null);
  const streamSessionIdRef = useRef<string | null>(null);
  const optimisticSessionIdRef = useRef<string | null>(null);
  const [pendingAssistantMsg, setPendingAssistantMsg] = useState<{ id: string; content: string; reasoning?: string; toolInvocations?: any[] } | null>(null);
  
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showAssistantPicker, setShowAssistantPicker] = useState(false);
  const [showShortcutSheet, setShowShortcutSheet] = useState(false);
  const [showRecallSheet, setShowRecallSheet] = useState(false);
  const [showShortcutManager, setShowShortcutManager] = useState(false);
  const [showToolManager, setShowToolManager] = useState(false);
  const [toolConfig, setToolConfig] = useState<any>({ disabledToolIds: [], customConfigs: {} });

  const [contextDialogState, setContextDialogState] = useState<{ isOpen: boolean, message?: any, contextMessages?: any[] }>({ isOpen: false });

  const inputBarRef = useRef<InputBarRef>(null);

  const settings = useSettingsStore();
  const providers = settings?.providers || [];
  
  // Calculate a safe fallback instead of hardcoding 'gpt-4o'
  const fallbackProvider = providers.length > 0 ? providers[0] : null;
  const fallbackModelId = fallbackProvider?.enabledModels?.[0] || fallbackProvider?.models?.[0]?.id || 'unknown';
  const fallbackProviderId = fallbackProvider?.providerId || 'unknown';

  // Resolve global defaults as an atomic pair to prevent provider/model mix-matching
  let defaultProviderInfo = fallbackProviderId;
  let defaultModelInfo = fallbackModelId;

  if (settings.globalModels?.globalDialogueProviderId && settings.globalModels?.globalDialogueModelId) {
    defaultProviderInfo = settings.globalModels.globalDialogueProviderId;
    defaultModelInfo = settings.globalModels.globalDialogueModelId;
  }

  // Model state defaults to the system setting
  const [currentProviderId, setCurrentProviderId] = useState<string>(defaultProviderInfo);
  const [currentModelId, setCurrentModelId] = useState<string>(defaultModelInfo);

  const userManuallySetModelRef = useRef<boolean>(false);
  const prevSessionIdRef = useRef<string | null>(null);

  // =====================================
  // 数据总线：获取业务模型与记忆
  // =====================================
  const { assistants, fetchAssistants } = useAssistantStore();
  const { shortcuts, loadShortcuts, addShortcut, updateShortcut, removeShortcut } = usePromptShortcutStore();
  const { profile: userProfile } = useUserProfileStore();
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);
  const [isSearchingRecall, setIsSearchingRecall] = useState(false);

  const handleRecallSearch = async (query: string, tab: 'diary' | 'memory') => {
    setIsSearchingRecall(true);
    try {
      if (tab === 'diary') {
        const dbEntries = await (window as any).api?.diary?.search(query);
        if (dbEntries) {
          setRecallItems(dbEntries.map(d => ({
            id: d.id.toString(),
            type: 'diary',
            title: d.title || t('common.untitled', '无标题'),
            snippet: d.snippet || d.content?.substring(0, 100) || '',
            date: new Date(d.createdAt).toISOString().split('T')[0]
          })));
        } else {
          setRecallItems([]);
        }
      } else {
        const dbEntries = await (window as any).api?.rag?.queryEntries({ keyword: query, limit: 30 });
        if (dbEntries) {
          setRecallItems(dbEntries.map(r => ({
            id: r.embeddingId,
            type: 'memory',
            title: t('agent.trace_title', '调用追踪 [{{modelId}}]', { modelId: r.modelId || t('common.system', '系统') }),
            snippet: r.text,
            date: new Date(r.createdAt || Date.now()).toISOString().split('T')[0]
          })));
        } else {
          setRecallItems([]);
        }
      }
    } catch (err) {
      console.error('[AgentScreen] Search fail:', err);
      setRecallItems([]);
    } finally {
      setIsSearchingRecall(false);
    }
  };

  const getLocalizedError = (rawErr: string) => {
    const lower = rawErr.toLowerCase();
    if (lower.includes('api key expired') || lower.includes('invalid_api_key') || lower.includes('api key not valid')) {
      return t('agent.error.api_key', 'API Key 已过期或无效，请转至模型设置中更新您的密钥。');
    }
    if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')) {
      return t('agent.error.rate_limit', '请求过于频繁或超出并发限制，请稍后再试。');
    }
    if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('econnrefused')) {
      return t('agent.error.network', '网络连接失败，请检查您的网络连接或代理设置。');
    }
    if (lower.includes('timeout') || lower.includes('deadline')) {
      return t('agent.error.timeout', '请求响应超时，请重试。');
    }
    if (lower.includes('insufficient_quota') || lower.includes('balance') || lower.includes('payment required')) {
      return t('agent.error.quota', '模型服务商提示账号额度不足。');
    }
    return t('agent.error.unknown', '出错了：{{msg}}', { msg: rawErr });
  };

  const lastToastedErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (streamError && !isStreaming) {
      if (lastToastedErrorRef.current !== streamError) {
        lastToastedErrorRef.current = streamError;
        toast.showError(
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontWeight: 600 }}>{t('agent.generation_failed', '回复生成失败')}</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>{getLocalizedError(streamError)}</div>
          </div>
        );
      }
    } else if (!streamError) {
      lastToastedErrorRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamError, isStreaming]);

  // 从助手列表中匹配当前会话依赖的实体
  // 注意：真实 IPC 应结合后端传入的会话 metadata
  let activeAssistantId: string | undefined = undefined;
  if (!sessionId) {
    activeAssistantId = searchParams.get('assistantId') || undefined;
  } else if (currentSession) {
    activeAssistantId = (currentSession as any).assistantId;
  }
  
  const currentAssistant = activeAssistantId
    ? assistants.find(a => String(a.id) === String(activeAssistantId)) || assistants.find(a => a.isDefault)
    : assistants.find(a => a.isDefault) || { id: 'default', name: 'BaiShou (Core)', emoji: '✨' };

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      userManuallySetModelRef.current = false;
      prevSessionIdRef.current = sessionId || null;
    }

    if (userManuallySetModelRef.current) return;

    const assistantProviderId = (currentAssistant as any)?.providerId;
    const assistantModelId = (currentAssistant as any)?.modelId;

    let baseProviderId = fallbackProviderId;
    let baseModelId = fallbackModelId;

    // Must resolve as atomic pairs! A mix-match of provider A and model B is fatal!
    if (assistantProviderId && assistantModelId && assistantProviderId !== 'unknown' && assistantModelId !== 'unknown') {
      baseProviderId = assistantProviderId;
      baseModelId = assistantModelId;
    } else if (
      settings.globalModels?.globalDialogueProviderId && 
      settings.globalModels?.globalDialogueModelId &&
      settings.globalModels.globalDialogueProviderId !== 'unknown' &&
      settings.globalModels.globalDialogueModelId !== 'unknown'
    ) {
      baseProviderId = settings.globalModels.globalDialogueProviderId;
      baseModelId = settings.globalModels.globalDialogueModelId;
    }

    if (baseModelId && baseModelId !== 'unknown' && baseProviderId && baseProviderId !== 'unknown') {
      setCurrentProviderId(baseProviderId);
      setCurrentModelId(baseModelId);
    }
  }, [sessionId, currentAssistant, settings.globalModels, fallbackProviderId, fallbackModelId]);

  useEffect(() => {
    fetchAssistants();
    loadShortcuts();

  }, [fetchAssistants, loadShortcuts]);
  // Token Usage IPC hook
  const [tokenUsage, setTokenUsage] = useState({ inputTokens: 0, outputTokens: 0, totalCostMicros: 0 });

  useEffect(() => {
  if (!sessionId) return;
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:get-token-usage', sessionId)
        .then(res => { if(res) setTokenUsage(res); })
        .catch(console.error);
    }
  }, [sessionId, isStreaming]);

  const totalInputTokens = tokenUsage?.inputTokens || 0;
  const totalOutputTokens = tokenUsage?.outputTokens || 0;
  const estimatedCost = (tokenUsage?.totalCostMicros || 0) / 1000000;

  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载真正的持久化聊天记录
  // retryCount > 1 时启用重试机制（用于流式结束后的首次同步，解决 DB 落盘时序问题）
  const refreshMessages = async (retryCount = 1): Promise<boolean> => {
    if (!sessionId) return false;
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const currentCount = Math.max(20, messages.length);
        const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, currentCount, 0);
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setHasMore(msgs.length === currentCount);
          return true;
        }
      } catch(e) {
        console.warn('[AgentScreen] refreshMessages attempt', attempt + 1, 'failed:', e);
      }
      // 非最后一次尝试时等待递增延迟
      if (attempt < retryCount - 1) {
        await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
      }
    }
    // 流式刚结束时后端可能还没落盘完，不要清空消息列表
    return false;
  };

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setHasMore(false);
      currentSessionIdRef.current = null;
      setPendingAssistantMsg(null);
      return;
    }

    // Switch session: reload initial 20
    const isNewSession = currentSessionIdRef.current !== sessionId;
    currentSessionIdRef.current = sessionId;

    if (isNewSession) {
      // 会话隔离：重置前端流式显示，后端流继续运行
      resetStream();
      streamSessionIdRef.current = null;
      setPendingAssistantMsg(null);
      window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, 0).then(msgs => {
         if (msgs && msgs.length > 0) {
            setMessages(msgs);
            setHasMore(msgs.length === 20);
         } else {
            if (optimisticSessionIdRef.current !== sessionId) {
              setMessages([]);
            }
            setHasMore(false);
         }
      }).catch(err => {
         console.error('[AgentScreen] Error loading messages', err);
         setMessages([]);
         setHasMore(false);
      });
    } else if (!isStreaming) {
      // 流式结束：仅当流属于当前会话时才构造 pending 消息
      if (streamSessionIdRef.current === sessionId && (streamingText || streamingReasoning)) {
        const tempId = `pending-${Date.now()}`;
        setPendingAssistantMsg({
          id: tempId,
          content: streamingText,
          reasoning: streamingReasoning,
        });
      }
      // 后台同步真库，带重试机制解决 DB 落盘时序问题
      // 模型只生成工具调用不产生文本时 streamingText 为空，pending 不会设置，
      // 此时更需要重试确保 DB 消息被正确加载
      refreshMessages(3).then((success) => {
        if (success) {
          setPendingAssistantMsg(null);
        }
      });
    }
  }, [sessionId, isStreaming]); // 改变房间或输出结束时强制同步真库

  // 监听流状态，一旦对话流结束，通知外层父组件重新拉取一次侧边栏列表
  // 这样能确保刚说完话的近期会话在排序中立刻冒泡置顶
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevIsStreamingRef.current === true && isStreaming === false) {
      if (loadSessions) {
        loadSessions(true);
      }
    }
    prevIsStreamingRef.current = isStreaming;
  }, [isStreaming, sessionId]);

  const handleLoadMore = async () => {
    if (!sessionId) return;
    try {
       const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, messages.length);
       if (msgs && msgs.length > 0) {
          setMessages(prev => [...msgs, ...prev]);
          setHasMore(msgs.length === 20);
       } else {
          setHasMore(false);
       }
    } catch (e) {}
  };

  const isUserScrollingRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // If we are more than 150px away from the bottom, assume user is reading
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
      isUserScrollingRef.current = !isAtBottom;
      setShowScrollButton(!isAtBottom);
    };
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', handleScroll);
    return () => {
      if (el) el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToBottom = (force = false) => {
    if (scrollRef.current && (!isUserScrollingRef.current || force)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (force) {
        setShowScrollButton(false);
        isUserScrollingRef.current = false;
      }
    }
  };

  const prevNewestIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newestMsg = messages[messages.length - 1];
    const isNewMessageAdded = newestMsg?.id && newestMsg.id !== prevNewestIdRef.current;
    
    if (isNewMessageAdded || isStreaming || streamingText || activeTool) {
       scrollToBottom();
    }
    prevNewestIdRef.current = newestMsg?.id || null;
  }, [messages, streamingText, streamingReasoning, isStreaming, activeTool]);

  const handleSend = async (text: string, attachments?: any[], searchMode?: boolean) => {
    let targetSessionId = sessionId;
    setSearchMode(searchMode ?? false);

    if (!targetSessionId) {
      if (typeof window !== 'undefined' && window.electron) {
        try {
          const astId = searchParams.get('assistantId') || currentAssistant?.id || 'default';
          const newTitle = text.trim().substring(0, 10) || t('agent.sessions.newChat', '新对话');
          targetSessionId = await window.electron.ipcRenderer.invoke('agent:create-session', {
             assistantId: astId,
             title: newTitle
          });
          if (targetSessionId) {
             optimisticSessionIdRef.current = targetSessionId;
             if (loadSessions) loadSessions(true);
             navigate(`/chat/${targetSessionId}`, { replace: true });
          }
        } catch (e: any) {
          console.error('[AgentScreen] Create session failed:', e);
          const errMsg = e?.message || e;
          alert(t('agent.error.create_session', '由于系统原因创建会话失败: {{msg}}', { msg: errMsg }));
          return;
        }
      }
    }
    
    if (!targetSessionId) return;

    // 乐观 UI 垫片
    const optimisticId = Date.now().toString();
    setMessages(prev => [...prev, {
       id: optimisticId,
       role: 'user',
       content: text,
       attachments,
       createdAt: new Date()
    }]);
    try {
      streamSessionIdRef.current = targetSessionId;
      await startChat(targetSessionId, text, currentProviderId, currentModelId, attachments, searchMode);
    } catch (e: any) {
      console.error('[AgentScreen] startChat failed:', e);
      // 回滚乐观UI更新
      setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
      // 显示错误提示
      toast.showError(t('agent.error.send_failed', '发送消息失败: {{msg}}', { msg: e?.message || '未知错误' }));
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:stop-stream').catch(console.error);
    }
  };

  return (
    <div className={styles.screen}>
      {/* Top Controls Area */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '16px 24px', gap: 12 }}>
        <div 
           style={{ padding: '4px 10px', fontSize: '12px', background: 'var(--bg-surface-highlight, rgba(148, 163, 184, 0.1))', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
           onClick={() => setShowModelSwitcher(true)}
        >
           {currentModelId === 'unknown' ? t('agent.no_model_selected', '暂未选择模型') : currentModelId} <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>▼</span>
        </div>
        
        <TokenBadge 
          inputTokens={totalInputTokens}
          outputTokens={totalOutputTokens}
          costMicros={estimatedCost * 1000000}
          onClick={() => setShowCostDialog(true)}
        />
      </div>

      <ChatCostDialog 
        isOpen={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        details={{
           modelName: currentModelId === 'unknown' ? t('agent.no_model_selected', '暂未选择模型') : currentModelId,
           promptTokens: totalInputTokens,
           completionTokens: totalOutputTokens,
           totalTokens: totalInputTokens + totalOutputTokens,
           estimatedCost: `$${estimatedCost.toFixed(6)}`
        }}
      />

      <AssistantPickerSheet
        isOpen={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        assistants={(assistants || []).map(a => ({ ...a, emoji: a.emoji || '✨', systemPrompt: a.systemPrompt || '' }))}
        pinnedIds={new Set(assistants.filter((a: any) => a.isPinned).map(a => String(a.id)))}
        onTogglePin={async (id, isPinned) => {
          if (typeof window !== 'undefined' && window.electron) {
            await window.electron.ipcRenderer.invoke('agent:pin-assistant', id, isPinned);
            await fetchAssistants();
          }
        }}
        onSelect={(ast) => {
          setShowAssistantPicker(false);
          // 尽量切换到已有会话，而不是每次创建新的
          if (typeof window !== 'undefined' && window.electron) {
             window.electron.ipcRenderer.invoke('agent:list-sessions-by-assistant', ast.id)
               .then((sessionsList: any[]) => {
                  if (sessionsList && sessionsList.length > 0) {
                     const sorted = sessionsList.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                     navigate(`/chat/${sorted[0].id}`);
                  } else {
                     navigate(`/chat?assistantId=${ast.id}`);
                  }
               })
               .catch(console.error);
          } else {
             // 降级回退方案，用于开发环境无真实后端 IPC 时
             navigate(`/chat?assistantId=${ast.id}`);
          }
        }}
      />

      <PromptShortcutSheet
        isOpen={showShortcutSheet}
        shortcuts={shortcuts as any}
        selectedIndex={0}
        onSelect={(shortcut) => {
           setShowShortcutSheet(false);
           inputBarRef.current?.insertText(shortcut.content);
        }}
      />
      
      <ShortcutManagerDialog 
        isOpen={showShortcutManager}
        onClose={() => setShowShortcutManager(false)}
        shortcuts={shortcuts as any}
        onAdd={addShortcut}
        onUpdate={updateShortcut}
        onDelete={removeShortcut}
        onSelect={(shortcut) => {
           setShowShortcutManager(false);
           inputBarRef.current?.insertText(shortcut.content);
        }}
      />
      
      <RecallDialog
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recallItems}
        isSearching={isSearchingRecall}
        onSearch={handleRecallSearch}
        onInject={(items) => {
           setShowRecallSheet(false);
           if (items.length > 0) {
             const merged = items.map(i => `<memory date="${i.date}" source="${i.title}">\n${i.snippet}\n</memory>`).join('\n\n');
             inputBarRef.current?.insertText(merged);
           }
        }}
      />

      {showModelSwitcher && (
        <ModelSwitcherPopup 
          onClose={() => setShowModelSwitcher(false)}
          providers={providers.map(p => ({
            id: p.providerId,
            name: p.name || p.providerId,
            type: p.type || 'custom',
            models: p.models || [],
            enabledModels: p.enabledModels || []
          }))}
          currentProviderId={currentProviderId}
          currentModelId={currentModelId}
          onSelect={(pid, mid) => {
            setCurrentProviderId(pid);
            setCurrentModelId(mid);
            userManuallySetModelRef.current = true;
            setShowModelSwitcher(false);
          }}
        />
      )}

      <Modal 
        isOpen={showToolManager} 
        onClose={() => setShowToolManager(false)}
        closeOnOverlayClick={true}
      >
         <AgentToolsView 
            config={toolConfig}
            onChange={(cfg) => setToolConfig(cfg)}
         />
      </Modal>

      {/* Message List */}
      <div className={styles.messageList} ref={scrollRef}>
         <div className={styles.messageContent}>
         
           {/* ==== 分页加载 ==== */}
           {hasMore && (
             <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
               <button 
                 onClick={handleLoadMore}
                 style={{ 
                   background: 'transparent', border: 'none', 
                   color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, 
                   cursor: 'pointer', opacity: 0.8, textDecoration: 'underline' 
                 }}
               >
                 {t('common.load_more', '点击加载更多记录')}
               </button>
             </div>
           )}

           {/* ==== 沉积历史 ==== */}
           {[...messages].map((msg, index, arr) => {
              let decodedContext: any[] | undefined = undefined;
              if (msg.role === 'assistant' && index > 0) {
                 const prevMsg = arr[index - 1];
                 if (prevMsg.role === 'user' && prevMsg.parts) {
                    const ctxPart = prevMsg.parts.find((p: any) => p.type === 'context_snapshot');
                    if (ctxPart && ctxPart.data?.snapshots) {
                       decodedContext = ctxPart.data.snapshots.map((s: any) => ({
                          role: 'system',
                          content: `${s.title ? '[' + s.title + '] ' : ''}${s.content}`,
                          timestamp: msg.createdAt || new Date()
                       }));
                    }
                 }
              }

              return (
                <ChatBubble 
                  key={msg.id}
                  message={{
                    id: msg.id,
                    sessionId: sessionId || 'default-session',
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    timestamp: msg.createdAt || new Date(),
                    toolInvocations: msg.toolInvocations,
                    attachments: msg.attachments,
                    inputTokens: msg.inputTokens,
                    outputTokens: msg.outputTokens,
                    isReasoning: msg.isReasoning,
                    costMicros: msg.costMicros,
                    contextMessages: decodedContext
                  }}
                  userProfile={{ nickname: userProfile?.nickname || 'User', avatarPath: userProfile?.avatarPath }}
                  aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
                  onShowContext={(m) => {
                     setContextDialogState({ isOpen: true, message: m, contextMessages: m.contextMessages || [] });
                  }}
                onRegenerate={() => {
                   if (typeof window !== 'undefined' && window.electron) {
                      window.electron.ipcRenderer.invoke('agent:regenerate', sessionId, msg.id, searchMode).then(refreshMessages);
                   }
                }}
                onEdit={() => {}}
                onSaveEdit={async (newContent: string) => {
                   if (!sessionId || !newContent.trim()) return;
                   if (typeof window !== 'undefined' && window.electron) {
                      await window.electron.ipcRenderer.invoke('agent:edit-message', sessionId, msg.id, newContent, currentProviderId, currentModelId, undefined, searchMode);
                      await refreshMessages();
                   }
                }}
                onResendEdit={async (newContent: string) => {
                   if (!sessionId || !newContent.trim()) return;
                   // 乐观 UI：保留用户消息，截断之后的消息
                   const msgIndex = messages.findIndex(m => m.id === msg.id);
                   if (msgIndex !== -1) {
                     setMessages(prev => prev.slice(0, msgIndex + 1));
                   }
                   if (typeof window !== 'undefined' && window.electron) {
                      await window.electron.ipcRenderer.invoke('agent:edit-message', sessionId, msg.id, newContent, currentProviderId, currentModelId, undefined, searchMode);
                   }
                }}
                onResend={() => {
                   if (msg.role === 'user' && sessionId) {
                      // 乐观 UI：保留用户消息，删除之后的所有消息（助手回复）
                      const msgIndex = messages.findIndex(m => m.id === msg.id);
                      if (msgIndex !== -1) {
                        setMessages(prev => prev.slice(0, msgIndex + 1));
                      }
                      // 调用后端重发（会更新 isStreaming 状态并流式返回）
                      streamSessionIdRef.current = sessionId;
                      resendChat(sessionId, msg.id, searchMode);
                   }
                }}
                onDelete={async () => {
                   const ok = await dialog.confirm(t('agent.chat.delete_msg_confirm', '您确定要删除这条消息历史吗？此操作不可逆转。'), t('common.confirm_delete', '确认删除'));
                   if (!ok) return;
                   if (typeof window !== 'undefined' && window.electron) {
                      window.electron.ipcRenderer.invoke('agent:delete-message', sessionId, msg.id).then(refreshMessages);
                   }
                }}
              />
              );
           })}

           {/* ==== 激战实录：流动气泡 ==== */}
           {isStreaming && (
              <StreamingBubble
                text={streamingText}
                isReasoning={Boolean(streamingReasoning && !streamingText)}
                activeToolName={activeTool?.name}
                aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
              />
           )}

           {/* ==== 流式结束后的过渡态：直接用 streamingText 渲染为最终气泡 ==== */}
           {pendingAssistantMsg && (
              <ChatBubble
                key={pendingAssistantMsg.id}
                message={{
                  id: pendingAssistantMsg.id,
                  sessionId: sessionId || 'default-session',
                  role: 'assistant',
                  content: pendingAssistantMsg.content,
                  timestamp: new Date(),
                  isReasoning: Boolean(pendingAssistantMsg.reasoning && !pendingAssistantMsg.content),
                }}
                aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
              />
           )}
           
           {/* ==== New Chat Empty State ==== */}
           {messages.length === 0 && !isStreaming && (
             <div style={{ flex: 1, padding: '24px 32px' }}>
               {(() => {
                 const title = currentSession?.title || '';
                  if (!title || title === t('agent.sessions.newChat', '新对话') || title === t('agent.sessions.new_session', '新会话')) return null;
                 return (
                   <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)', opacity: 0.9 }}>
                     {title}
                   </h2>
                 );
               })()}
             </div>
           )}
         </div>
      </div>

      {/* Floating Scroll-to-Bottom Button */}
      {showScrollButton && (
        <div 
          onClick={() => scrollToBottom(true)}
          style={{
            position: 'absolute',
            bottom: '100px',
            right: '32px',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface, #FFFFFF)',
            border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 100,
            color: 'var(--text-secondary, #64748b)',
            transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
          title={t('agent.chat.scroll_to_bottom', '回到最新消息')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        </div>
      )}

      {contextDialogState.message && (
        <ContextChainDialog 
          isOpen={contextDialogState.isOpen}
          onClose={() => setContextDialogState(prev => ({ ...prev, isOpen: false }))}
          message={contextDialogState.message}
          contextMessages={contextDialogState.contextMessages || []}
        />
      )}

      {/* Input Box */}
      <div className={styles.inputContainer}>
         <InputBar 
           ref={inputBarRef}
           isLoading={isStreaming}
           onSend={handleSend}
           onStop={handleStop}
           assistantName={currentAssistant?.name || 'BaiShou'}
           onAssistantTap={() => setShowAssistantPicker(true)}
           onTriggerShortcut={() => setShowShortcutSheet(true)}
           onManageShortcuts={() => setShowShortcutManager(true)}
           onRecall={() => setShowRecallSheet(true)}
           onOpenTools={() => setShowToolManager(true)}
           searchMode={searchMode}
           onToggleSearchMode={toggleSearchMode}
         />
      </div>
    </div>
  );
};

