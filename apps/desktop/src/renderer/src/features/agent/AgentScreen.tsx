import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ChatBubble, 
  StreamingBubble, 
  InputBar, 
  TokenBadge,
  ModelSwitcher,
  ChatCostDialog,
  AssistantPickerSheet,
  PromptShortcutSheet,
  RecallBottomSheet,
  ChatAppBar
} from '@baishou/ui';
import type { InputBarRef } from '@baishou/ui';
import { useSettingsStore, useAssistantStore, usePromptShortcutStore } from '@baishou/store';
import type { RecallItem } from '@baishou/ui';
import styles from './AgentScreen.module.css';
import { useAgentStream } from './hooks/useAgentStream';

export const AgentScreen: React.FC = () => {
  const { sessionId } = useParams();
  
  // =====================================
  // 接入军火级底层通道
  // =====================================
  const { 
    text: streamingText, 
    reasoning: streamingReasoning, 
    activeTool, 
    isStreaming, 
    startChat 
  } = useAgentStream();
  
  const [messages, setMessages] = useState<any[]>([]);
  
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [showAssistantPicker, setShowAssistantPicker] = useState(false);
  const [showShortcutSheet, setShowShortcutSheet] = useState(false);
  const [showRecallSheet, setShowRecallSheet] = useState(false);
  const inputBarRef = useRef<InputBarRef>(null);

  const settings = useSettingsStore();
  const defaultModelInfo = settings.globalModels?.globalDialogueModelId || 'gpt-4o';
  
  // Model state defaults to the system setting
  const [currentProviderId, setCurrentProviderId] = useState<string>(settings.globalModels?.globalDialogueProviderId || 'openai_1');
  const [currentModelId, setCurrentModelId] = useState<string>(defaultModelInfo);

  // =====================================
  // 数据总线：获取业务模型与记忆
  // =====================================
  const { assistants, fetchAssistants } = useAssistantStore();
  const { shortcuts, loadShortcuts } = usePromptShortcutStore();
  const [recallItems, setRecallItems] = useState<RecallItem[]>([]);

  // 从助手列表中匹配当前会话依赖的实体
  // 注意：真实 IPC 应结合后端传入的会话 metadata
  const currentAssistant = assistants.find(a => a.id === sessionId) || 
                           assistants.find(a => a.isDefault) || 
                           { name: 'BaiShou (Core)', emoji: '🤖' };

  // 用于在前端乐观更新 AppBar 的名称
  const [chatTitle, setChatTitle] = useState(currentAssistant.name);

  useEffect(() => {
    setChatTitle(currentAssistant.name);
  }, [currentAssistant.name]);

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
             title: `片段追踪 [${r.modelId || '系统'}]`,
             snippet: r.text,
             date: new Date(r.createdAt || Date.now()).toISOString().split('T')[0]
           })));
        })
        .catch((e: Error) => console.error('[AgentScreen] Failed to load initial RAG memories:', e));
    }
  }, [fetchAssistants, loadShortcuts]);
  const [providers] = useState<any[]>(settings.providers || []);

  // Token Usage IPC hook
  const [tokenUsage, setTokenUsage] = useState({ inputTokens: 0, outputTokens: 0, totalCostMicros: 0 });

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:get-token-usage', sessionId)
        .then(setTokenUsage)
        .catch(console.error);
    }
  }, [sessionId, isStreaming]);

  const totalInputTokens = tokenUsage.inputTokens;
  const totalOutputTokens = tokenUsage.outputTokens;
  const estimatedCost = tokenUsage.totalCostMicros / 1000000;

  const scrollRef = useRef<HTMLDivElement>(null);

  // 加载真正的持久化聊天记录
  const refreshMessages = async () => {
    if (!sessionId) return;
    try {
      const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId);
      setMessages(msgs || []);
    } catch(e) {}
  };

  useEffect(() => {
    refreshMessages();
  }, [sessionId, isStreaming]); // 改变房间或输出结束时强制同步真库

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, streamingReasoning, isStreaming, activeTool]);

  const handleSend = async (text: string, attachments?: any[]) => {
    if (!sessionId) return;
    // 乐观 UI 垫片
    setMessages(prev => [{ 
       id: Date.now().toString(), 
       role: 'user', 
       content: text, 
       attachments,
       createdAt: new Date() 
    }, ...prev]);
    // 假设未来 startChat 也能接附件
    await startChat(sessionId, text);
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:stop-stream').catch(console.error);
    }
  };

  return (
    <div className={styles.screen}>
      <ChatAppBar 
        profile={{
          name: chatTitle,
          emoji: (currentAssistant as any).emoji,
          modelIdentifier: currentModelId,
        }}
        onRenameChat={(newName) => {
          setChatTitle(newName);
          if (typeof window !== 'undefined' && (window as any).api?.session) {
             (window as any).api.session.update(sessionId, { title: newName }).catch(console.error);
          }
        }}
        onClearChat={() => {
           if (typeof window !== 'undefined' && (window as any).api?.session) {
             (window as any).api.session.clearMessages(sessionId).then(() => setMessages([]));
           } else {
             setMessages([]);
           }
        }}
        onOpenMemory={() => setShowRecallSheet(true)}
      />

      {/* Legacy/Secondary Tool Bar */}
      <div className={styles.appBar} style={{ height: '36px', borderBottom: 'none', background: 'transparent' }}>
        <div 
           className={styles.modelSwitcherTrigger}
           style={{ padding: '2px 8px', fontSize: '13px' }}
           onClick={() => setShowModelSwitcher(true)}
        >
           <span className={styles.modelName}>{currentModelId} ▾</span>
        </div>
        
        <div className={styles.appBarRight}>
           <TokenBadge 
             inputTokens={totalInputTokens}
             outputTokens={totalOutputTokens}
             costMicros={estimatedCost * 1000000}
             onClick={() => setShowCostDialog(true)}
           />
        </div>
      </div>

      <ChatCostDialog 
        isOpen={showCostDialog}
        onClose={() => setShowCostDialog(false)}
        details={{
           modelName: currentModelId,
           promptTokens: totalInputTokens,
           completionTokens: totalOutputTokens,
           totalTokens: totalInputTokens + totalOutputTokens,
           estimatedCost: `$${estimatedCost.toFixed(4)}`
        }}
      />

      <AssistantPickerSheet
        isOpen={showAssistantPicker}
        onClose={() => setShowAssistantPicker(false)}
        assistants={assistants}
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
        shortcuts={shortcuts}
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

      <ModelSwitcher 
        isOpen={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        providers={providers}
        currentProviderId={currentProviderId}
        currentModelId={currentModelId}
        onSelect={(pid, mid) => {
          setCurrentProviderId(pid);
          setCurrentModelId(mid);
          setShowModelSwitcher(false);
        }}
      />

      {/* Message List */}
      <div className={styles.messageList} ref={scrollRef}>
         <div className={styles.messageContent}>
         
           {/* ==== 激战实录：流动气泡 ==== */}
           {isStreaming && (
              <StreamingBubble 
                text={streamingText}
                isReasoning={Boolean(streamingReasoning && !streamingText)}
                activeToolName={activeTool?.name}
              />
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
                onRegenerate={() => {
                   if (typeof window !== 'undefined' && (window as any).api?.agent) {
                      (window as any).api.agent.regenerateMessage(sessionId, msg.id).then(refreshMessages);
                   }
                }}
                onEdit={() => {
                   if (msg.role === 'user') {
                      inputBarRef.current?.insertText(msg.content);
                   }
                }}
              />
           ))}
         </div>
      </div>

      {/* Input Box */}
      <div className={styles.inputContainer}>
         <InputBar 
           isLoading={isStreaming}
           onSend={handleSend}
           onStop={handleStop}
           assistantName={currentAssistant?.name || 'BaiShou'}
           onAssistantTap={() => setShowAssistantPicker(true)}
         />
      </div>
    </div>
  );
};
