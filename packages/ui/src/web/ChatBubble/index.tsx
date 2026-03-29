import React, { useState } from 'react';
import styles from './ChatBubble.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { TokenBadge } from '../TokenBadge';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  toolCalls?: { id: string; name: string; result: string; isError?: boolean }[];
}

interface ChatBubbleProps {
  message: ChatMessage;
  userProfile?: { nickname: string; avatarUrl?: string };
  aiProfile?: { name: string; avatarUrl?: string };
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  userProfile = { nickname: 'ME' },
  aiProfile = { name: 'AI Partner' }
}) => {
  const [expandedTools, setExpandedTools] = useState(false);
  const isUser = message.role === 'user';
  const timeStr = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.role === 'tool') {
    return null; // Tool messages are nested in parent
  }

  return (
    <div className={`${styles.bubbleWrapper} ${isUser ? styles.userRow : styles.aiRow}`}>
      {!isUser && (
        <div className={styles.avatar}>
          {aiProfile.avatarUrl ? (
            <img src={aiProfile.avatarUrl} alt="AI Avatar" />
          ) : (
            <span className={styles.aiIcon}>✨</span>
          )}
        </div>
      )}

      <div className={styles.contentCol}>
        <div className={styles.header}>
          <span className={styles.name}>{isUser ? userProfile.nickname : aiProfile.name}</span>
          <span className={styles.time}>{timeStr}</span>
        </div>

        <div className={`${styles.bubbleContent} ${isUser ? styles.userContent : styles.aiContent}`}>
          {isUser ? (
            <p className={styles.userText}>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
        </div>

        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className={styles.toolCallsGroup}>
            <div className={styles.toolGroupHeader} onClick={() => setExpandedTools(!expandedTools)}>
              <div className={styles.toolIconWrapper}>
                <span>🔧</span>
              </div>
              <span className={styles.toolLabel}>使用了 {message.toolCalls.length} 个工具</span>
              <span className={styles.expandIcon}>{expandedTools ? '▲' : '▼'}</span>
            </div>
            {expandedTools && (
              <div className={styles.toolResults}>
                {message.toolCalls.map((tool) => (
                  <div key={tool.id} className={`${styles.toolItem} ${tool.isError ? styles.toolError : ''}`}>
                    <div className={styles.toolItemHeader}>
                      <span className={styles.statusIcon}>{tool.isError ? '❌' : '✅'}</span>
                      <span className={styles.toolName}>{tool.name}</span>
                    </div>
                    <pre className={styles.toolResultBody}>{tool.result}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isUser && (message.inputTokens || message.outputTokens) && (
          <div className={styles.footerRow}>
             <TokenBadge 
               inputTokens={message.inputTokens} 
               outputTokens={message.outputTokens} 
               durationMs={message.durationMs} 
             />
          </div>
        )}
      </div>

      {isUser && (
        <div className={styles.avatar}>
           {userProfile.avatarUrl ? (
            <img src={userProfile.avatarUrl} alt="User Avatar" />
          ) : (
            <span>{userProfile.nickname.charAt(0).toUpperCase()}</span>
          )}
        </div>
      )}
    </div>
  );
};
