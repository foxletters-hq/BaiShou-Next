import React, { useState } from 'react';
import styles from './ChatBubble.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer'; 
import { TokenBadge } from '../TokenBadge'; 
import { MessageActionBar } from '../MessageActionBar'; 
import { ToolResultGroup } from '../ToolResultGroupCard';
import { MockChatMessage, MockChatAttachment, MockToolInvocation } from '@baishou/shared/src/mock/agent.mock';

import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast/useToast';

export interface ChatBubbleProps {
  message: MockChatMessage;
  userProfile?: { nickname: string; avatarPath?: string | null };
  aiProfile?: { name: string; avatarPath?: string | null; emoji?: string | null };
  onEdit?: () => void;
  onRegenerate?: () => void;
  onResend?: () => void;
  onCopy?: () => void;
  onShowContext?: (msg: MockChatMessage) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  userProfile = { nickname: 'U' },
  aiProfile = { name: 'AI' }, 
  onEdit,
  onRegenerate,
  onResend,
  onCopy,
  onShowContext
}) => {
  const { t } = useTranslation();
  
  const toast = useToast();
  const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
  
  if (message.role === 'tool') {
    return null;
  }
  
  const isUser = message.role === 'user';
  
  const formatTime = (date: Date) => {
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return t('common.just_now', '刚刚');
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t('common.minutes_ago', '分钟前')}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('common.hours_ago', '小时前')}`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };
  
  const handleCopy = () => {
    if (onCopy) {
      onCopy();
    } else {
      if (message.content) {
        navigator.clipboard.writeText(message.content);
        toast.showSuccess(t('common.copied', '已复制到剪贴板'));
      }
    }
    setContextMenu(null);
  };
  
  const renderAttachments = (isUserBubble: boolean) => {
    if (!message.attachments || message.attachments.length === 0) return null;
    return (
      <div className={`${styles.attachmentsWrap} ${isUserBubble ? styles.alignEnd : styles.alignStart}`}>
        {message.attachments.map((att: MockChatAttachment) => (
          <div key={att.id} className={styles.attachmentItem}>
             {att.isImage ? (
               <img src={att.filePath || 'placeholder.png'} className={styles.attImage} alt={att.fileName}/>
             ) : (
               <div className={styles.attDocument}>
                 <span className={styles.attDocIcon}>{att.isPdf ? '📄' : '📁'}</span>
                 <span className={styles.attDocName}>{att.fileName}</span>
               </div>
             )}
          </div>
        ))}
      </div>
    );
  };

  const renderUserBubble = () => {
    return (
      <div className={`${styles.bubbleRow} ${styles.userRow}`}>
        <div className={styles.messageCol}>
           <div className={`${styles.nameTimeRow} ${styles.justifyEnd}`}>
             <span className={styles.nameLabel}>{userProfile.nickname}</span>
             <span className={styles.timeLabel} title={message.timestamp.toLocaleString()}>
               {formatTime(message.timestamp)}
             </span>
           </div>
           
           <div className={styles.userBubbleCard}>
              {renderAttachments(true)}
              {message.content && <div className={styles.textContentUser}>{message.content}</div>}
           </div>
           
           <MessageActionBar 
             isAI={false} 
             onCopy={handleCopy} 
             onRetry={onResend} 
           />
        </div>
        
        <div className={styles.avatarWrap}>
          {userProfile.avatarPath ? (
             <img src={userProfile.avatarPath} alt="avatar" className={styles.avatarImg}/>
          ) : (
             <div className={`${styles.avatarFallback} ${styles.userAvatar}`}>{userProfile.nickname.charAt(0).toUpperCase()}</div>
          )}
        </div>
      </div>
    );
  };

  const renderAiBubble = () => {
    const aiName = aiProfile.name || t('agent.chat.ai_label');
    return (
      <div className={`${styles.bubbleRow} ${styles.aiRow}`}>
         <div className={styles.avatarWrap}>
           {aiProfile.avatarPath ? (
               <img src={aiProfile.avatarPath} alt="avatar" className={styles.avatarImg}/>
            ) : aiProfile.emoji ? (
               <div className={`${styles.avatarFallback} ${styles.aiAvatar}`}>{aiProfile.emoji}</div>
            ) : (
               <div className={`${styles.avatarFallback} ${styles.aiAvatar}`}>✨</div>
            )}
         </div>
         
         <div className={styles.messageCol}>
            <div className={`${styles.nameTimeRow} ${styles.justifyStart}`}>
               <span className={styles.nameLabel}>{aiName}</span>
               <span className={styles.timeLabel} title={message.timestamp.toLocaleString()}>
                 {formatTime(message.timestamp)}
               </span>
            </div>
            
            <div className={styles.aiBubbleCard}>
               {renderAttachments(false)}
               {message.isReasoning ? (
                 <details className={styles.reasoningDetails}>
                   <summary className={styles.reasoningSummary}>
                      <span className={styles.reasoningIcon}>🤔</span>
                      {t('agent.chat.reasoning', '思考过程')}
                   </summary>
                   {message.content && <MarkdownRenderer content={message.content} />}
                 </details>
               ) : (
                 message.content && <MarkdownRenderer content={message.content} />
               )}

               {message.toolInvocations && message.toolInvocations.length > 0 && (
                 <div className={styles.toolGroupContainer}>
                   <ToolResultGroup invocations={message.toolInvocations} />
                 </div>
               )}
            </div>
            
            <div className={styles.aiFooterRow}>
               <MessageActionBar 
                 isAI={true} 
                 onCopy={handleCopy} 
                 onRetry={onRegenerate} 
               />
               <div className={styles.footerRight}>
                 {message.inputTokens !== undefined && (
                   <TokenBadge 
                      inputTokens={message.inputTokens} 
                      outputTokens={message.outputTokens || 0} 
                      durationMs={message.costMicros} /* fallback for visual display */
                   />
                 )}
                 {message.contextMessages && message.contextMessages.length > 0 && (
                   <button className={styles.contextBtn} onClick={() => onShowContext && onShowContext(message)} title="查看对话上下文树">
                      🌿
                   </button>
                 )}
               </div>
            </div>
         </div>
      </div>
    );
  };

  return (
    <>
      <div className={styles.chatBubbleContainer} onContextMenu={handleContextMenu}>
        {isUser ? renderUserBubble() : renderAiBubble()}
      </div>
      {contextMenu && (
        <div 
          className={styles.contextMenuOverlay} 
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
        >
          <div className={styles.contextMenu} style={{ top: contextMenu.y, left: contextMenu.x }}>
             <button onClick={handleCopy}>{t('common.copy', '复制')}</button>
             {isUser ? (
               <>
                 {onResend && <button onClick={() => { setContextMenu(null); onResend(); }}>{t('common.retry', '重新发送')}</button>}
                 {onEdit && <button onClick={() => { setContextMenu(null); onEdit(); }}>{t('common.edit', '编辑')}</button>}
               </>
             ) : (
               <>
                 {onRegenerate && <button onClick={() => { setContextMenu(null); onRegenerate(); }}>{t('common.regenerate', '重新生成')}</button>}
               </>
             )}
          </div>
        </div>
      )}
    </>
  );
};
