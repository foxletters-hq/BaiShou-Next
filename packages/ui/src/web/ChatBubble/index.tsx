import React from 'react';
import styles from './ChatBubble.module.css';
import { MarkdownRenderer } from '../MarkdownRenderer'; 
import { TokenBadge } from '../TokenBadge'; 
import { MessageActionBar } from '../MessageActionBar'; 
import { MockChatMessage } from '@baishou/shared/src/mock/agent.mock';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

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
  onRegenerate,
  onResend,
  onCopy,
  onShowContext
}) => {
  const { t } = useTranslation();
  
  if (message.role === 'tool') {
    return null;
  }
  
  const isUser = message.role === 'user';
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleCopy = () => {
    if (onCopy) {
      onCopy();
    } else {
      if (message.content) {
        navigator.clipboard.writeText(message.content);
        // TODO: [Agent1-Dependency] 替换为 import AppToast
        alert(t('common.copied'));
      }
    }
  };
  
  const renderAttachments = (isUserBubble: boolean) => {
    if (!message.attachments || message.attachments.length === 0) return null;
    return (
      <div className={`${styles.attachmentsWrap} ${isUserBubble ? styles.alignEnd : styles.alignStart}`}>
        {message.attachments.map((att) => (
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
             <span className={styles.timeLabel}>{formatTime(message.timestamp)}</span>
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
               <span className={styles.timeLabel}>{formatTime(message.timestamp)}</span>
            </div>
            
            <div className={styles.aiBubbleCard}>
               {renderAttachments(false)}
               {message.content && <MarkdownRenderer content={message.content} />}
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
    <div className={styles.chatBubbleContainer}>
      {isUser ? renderUserBubble() : renderAiBubble()}
    </div>
  );
};
