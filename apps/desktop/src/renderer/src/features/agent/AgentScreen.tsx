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
import { useAgentStore } from '@baishou/store/src/stores/agent.store';
import styles from './AgentScreen.module.css';

export const AgentScreen: React.FC = () => {
  const { sessionId } = useParams();
  const { messages, isLoading, setLoading, clearSession, sendMessage, loadMessages } = useAgentStore();
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [currentProviderId, setCurrentProviderId] = useState<string>('openai_1');
  const [currentModelId, setCurrentModelId] = useState<string>('gpt-4o');
  const [providers, setProviders] = useState(MOCK_PROVIDERS);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset messages when session changes
    if (sessionId) {
      clearSession();
      // Load real messages
      loadMessages(sessionId);

      setIsStreaming(false);
      setStreamingText('');
      
      // Initialize Stream IPC listeners mapping to store
      const store = useAgentStore.getState();
      if ((store as any).initIpcListeners) {
        (store as any).initIpcListeners();
      }
      
      // Load providers from backend IPC instead of static mock
      // @ts-ignore
      if (window.api && window.api.getProviders) {
        // @ts-ignore
        window.api.getProviders().then(res => {
          if (res && res.length > 0) {
            setProviders(res);
          }
        }).catch(console.error);
      }
    }
  }, [sessionId, clearSession, loadMessages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      // In flex-col-reverse, scrollTop = 0 means bottom natively. We shouldn't scrollHeight.
      // Or we can just let flex-col-reverse handle anchoring natively
      scrollRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, isStreaming]);

  const handleSend = async (text: string, options?: any) => {
    if (!sessionId) return;
    sendMessage(sessionId, text);
  };

  const handleStop = () => {
    setIsStreaming(false);
    setLoading(false);
  };

  return (
    <div className={styles.screen}>
      {/* App Bar */}
      <div className={styles.appBar}>
        <div 
           className={styles.modelSwitcherTrigger}
           onClick={() => setShowModelSwitcher(true)}
        >
           <span className={styles.modelIcon}>✨</span>
           <span className={styles.modelName}>{currentModelId}</span>
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
           {isStreaming && (
              <StreamingBubble 
                text={streamingText}
              />
           )}
           {[...messages].reverse().map(msg => (
              <ChatBubble 
                key={msg.id}
                message={{
                  id: msg.id,
                  role: msg.role === 'user' ? 'user' : 'assistant',
                  content: msg.content,
                  createdAt: msg.timestamp || new Date()
                }}
                onEdit={msg.role === 'user' ? () => console.log('1') : undefined}
              />
           ))}
         </div>
      </div>

      {/* Input Box */}
      <div className={styles.inputContainer}>
         <InputBar 
           isLoading={isLoading || isStreaming}
           onSend={handleSend}
           onStop={handleStop}
           assistantName={MOCK_ASSISTANTS_LIST[0].name}
           onAssistantTap={() => console.log('Assistant change requested')}
         />
      </div>
    </div>
  );
};
