import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  ChatBubble, 
  StreamingBubble, 
  InputBar, 
  TokenBadge,
  ModelSwitcher,
  MOCK_PROVIDERS,
  MOCK_ASSISTANTS_LIST
} from '@baishou/ui';
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
    error, 
    startChat 
  } = useAgentStream();
  
  const [messages, setMessages] = useState<any[]>([]);
  
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [currentProviderId, setCurrentProviderId] = useState<string>('openai_1');
  const [currentModelId, setCurrentModelId] = useState<string>('gpt-4o');
  const [providers, setProviders] = useState(MOCK_PROVIDERS);

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

  const handleSend = async (text: string) => {
    if (!sessionId) return;
    // 乐观 UI 垫片
    setMessages(prev => [{ id: Date.now().toString(), role: 'user', content: text, createdAt: new Date() }, ...prev]);
    await startChat(sessionId, text);
  };

  const handleStop = () => {
    // Phase 2 implementation for stopping stream
  };

  return (
    <div className={styles.screen}>
      {/* App Bar */}
      <div className={styles.appBar}>
        <div 
           className={styles.modelSwitcherTrigger}
           onClick={() => setShowModelSwitcher(true)}
        >
           <span className={styles.modelIcon}>🤖</span>
           <span className={styles.modelName}>DeepSeek R1 (Connected)</span>
           <span className={styles.chevron}>▾</span>
        </div>
        
        <div className={styles.appBarRight}>
           <TokenBadge 
             tokenCount={2500} 
             costEstimate={0.005} 
             onTap={() => console.log('Token details clicked')}
           />
        </div>
      </div>

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
                reasoningText={streamingReasoning} // Optional logic for R1
                toolState={activeTool ? `正在调度神经元组件: ${activeTool.name}...` : undefined}
                error={error || undefined}
              />
           )}
           
           {/* ==== 沉积历史 ==== */}
           {[...messages].map(msg => (
              <ChatBubble 
                key={msg.id}
                message={{
                  id: msg.id,
                  role: msg.role === 'user' ? 'user' : 'assistant',
                  content: msg.content,
                  createdAt: msg.createdAt || new Date()
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
           assistantName={"BaiShou (Core 1.0)"}
           onAssistantTap={() => {}}
         />
      </div>
    </div>
  );
};
