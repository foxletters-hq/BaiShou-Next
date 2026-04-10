import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { 
  ChatBubble, 
  StreamingBubble, 
  InputBar, 
  TokenBadge,
  ModelSwitcherPopup,
  ChatCostDialog,
  AssistantPickerSheet,
  PromptShortcutSheet,
  RecallBottomSheet,
  Modal,
  AgentToolsView,
  useDialog
} from '@baishou/ui';
import type { InputBarRef } from '@baishou/ui';
import { useSettingsStore, useAssistantStore, usePromptShortcutStore, useUserProfileStore } from '@baishou/store';
import type { RecallItem } from '@baishou/ui';
import styles from './AgentScreen.module.css';
import { useAgentStream } from './hooks/useAgentStream';
import { useTranslation } from 'react-i18next';
import { MdAutoAwesome } from 'react-icons/md';


export const AgentScreen: React.FC = () => {
  const { t } = useTranslation();
  const { sessionId } = useParams();
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
    editChat
  } = useAgentStream();

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showAssistantPicker, setShowAssistantPicker] = useState(false);
  const [showShortcutSheet, setShowShortcutSheet] = useState(false);
  const [showRecallSheet, setShowRecallSheet] = useState(false);
  const [showToolManager, setShowToolManager] = useState(false);
  const [toolConfig, setToolConfig] = useState<any>({ disabledToolIds: [], customConfigs: {} });

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
  const { shortcuts, loadShortcuts } = usePromptShortcutStore();
  const { profile: userProfile } = useUserProfileStore();
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);

  // 从助手列表中匹配当前会话依赖的实体
  // 注意：真实 IPC 应结合后端传入的会话 metadata
  const currentAssistant = assistants.find(a => a.id === sessionId) || 
                           assistants.find(a => a.isDefault) || 
                           { id: 'default', name: 'BaiShou (Core)', emoji: '✨' };

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

    // 加载 RAG 模块最初始的几十条最新记忆/日记用于记忆打捞展示
    if (typeof window !== 'undefined' && (window as any).api?.rag) {
      (window as any).api.rag.queryEntries({ keyword: '' })
        .then((res: any[]) => {
  setRecallItems(res.slice(0, 30).map(r => ({
             id: r.embeddingId,
             type: 'memory',
             title: t('agent.trace_title', '调用追踪 [{{modelId}}]', { modelId: r.modelId || t('common.system', '系统') }),
             snippet: r.text,
             date: new Date(r.createdAt || Date.now()).toISOString().split('T')[0]
           })));
        })
        .catch((e: Error) => console.error('[AgentScreen] Failed to load initial RAG memories:', e));
    }
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
  const refreshMessages = async () => {
    if (!sessionId) return;
    try {
      const currentCount = Math.max(20, messages.length);
      const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, currentCount, 0);
      if (msgs && msgs.length > 0) {
        setMessages(msgs);
        setHasMore(msgs.length === currentCount);
      } else if (!isStreaming) {
        setMessages([]);
        setHasMore(false);
      }
    } catch(e) {}
  };

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setHasMore(false);
      currentSessionIdRef.current = null;
      return;
    }
    
    // Switch session: reload initial 20
    const isNewSession = currentSessionIdRef.current !== sessionId;
    currentSessionIdRef.current = sessionId;
    
    if (isNewSession) {
      window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, 0).then(msgs => {
         if (msgs && msgs.length > 0) {
            setMessages(msgs);
            setHasMore(msgs.length === 20);
         } else {
            setMessages([]);
            setHasMore(false);
         }
      });
    } else {
      refreshMessages();
    }
  }, [sessionId, isStreaming]); // 改变房间或输出结束时强制同步真库

  // 监听流状态，一旦对话流结束，通知外层父组件重新拉取一次侧边栏列表
  // 这样能确保刚说完话的近期会话在排序中立刻冒泡置顶
  // 监听流状态，一旦对话流结束，通知外层父组件重新拉取一次侧边栏列表
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    if (prevIsStreamingRef.current === true && isStreaming === false) {
      if (sessionId && loadSessions) {
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

  const handleSend = async (text: string, attachments?: any[]) => {
    let targetSessionId = sessionId;

    if (!targetSessionId) {
      if (typeof window !== 'undefined' && window.electron) {
        targetSessionId = await window.electron.ipcRenderer.invoke('agent:create-session', {
           assistantId: currentAssistant?.id || 'default'
        });
        if (targetSessionId) {
           navigate(`/c/${targetSessionId}`, { replace: true });
        }
      }
    }
    
    if (!targetSessionId) return;
    
    if (editingMessageId) {
      const eMsgId = editingMessageId;
      setEditingMessageId(null);
      await editChat(targetSessionId, eMsgId, text, currentProviderId, currentModelId);
    } else {
      // 乐观 UI 垫片
      setMessages(prev => [...prev, { 
         id: Date.now().toString(), 
         role: 'user', 
         content: text, 
         attachments,
         createdAt: new Date() 
      }]);
      await startChat(targetSessionId, text, currentProviderId, currentModelId);
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
           {currentModelId} <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>▼</span>
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
           modelName: currentModelId,
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
        onSelect={(ast) => {
          setShowAssistantPicker(false);
          // 强绑定：切换 Agent 即切换会话
          if (typeof window !== 'undefined' && (window as any).api?.session) {
             (window as any).api.session.create({ assistantId: ast.id })
               .then((newSessionId: string) => navigate(`/chat/${newSessionId}`))
               .catch(console.error);
          } else {
             // 降级回退方案，用于开发环境无真实后端 IPC 时
             navigate(`/chat/new-${ast.id}`);
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
      
      <RecallBottomSheet
        isOpen={showRecallSheet}
        onClose={() => setShowRecallSheet(false)}
        items={recallItems}
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
                 点击加载更多记录
               </button>
             </div>
           )}

           {/* ==== 沉积历史 ==== */}
           {[...messages].map(msg => (
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
                  isReasoning: msg.isReasoning
                }}
                userProfile={{ nickname: userProfile?.nickname || 'User', avatarPath: userProfile?.avatar }}
                aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
                onRegenerate={() => {
                   if (typeof window !== 'undefined' && window.electron) {
                      window.electron.ipcRenderer.invoke('agent:regenerate', sessionId).then(refreshMessages);
                   }
                }}
                onEdit={() => {
                   if (msg.role === 'user') {
                      inputBarRef.current?.insertText(msg.content);
                      setEditingMessageId(msg.id);
                   }
                }}
                onResend={() => {
                   if (msg.role === 'user') {
                      handleSend(msg.content);
                   }
                }}
                onDelete={async () => {
                   const ok = await dialog.confirm('您确定要删除这条消息历史吗？此操作不可逆转。', '确认删除');
                   if (!ok) return;
                   if (typeof window !== 'undefined' && window.electron) {
                      window.electron.ipcRenderer.invoke('agent:delete-message', sessionId, msg.id).then(refreshMessages);
                   }
                }}
              />
           ))}

           {/* ==== 激战实录：流动气泡 ==== */}
           {isStreaming && (
              <StreamingBubble 
                text={streamingText}
                isReasoning={Boolean(streamingReasoning && !streamingText)}
                activeToolName={activeTool?.name}
                aiProfile={{ name: currentAssistant?.name || 'AI', avatarPath: currentAssistant?.avatarPath, emoji: currentAssistant?.emoji }}
              />
           )}

           {/* ==== New Chat Empty State ==== */}
           {messages.length === 0 && !isStreaming && (
             <div style={{ flex: 1, padding: '24px 32px' }}>
               {(() => {
                 const title = currentSession?.title || '';
                 if (!title || title === '新对话' || title === '新会话') return null;
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
          title="回到最新消息"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
          </svg>
        </div>
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
           onRecall={() => setShowRecallSheet(true)}
           onOpenTools={() => setShowToolManager(true)}
         />
      </div>
    </div>
  );
};
