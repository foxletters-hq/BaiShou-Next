import React, { useState } from 'react';
import styles from './MessageActionBar.module.css';
import { Copy, RefreshCcw, Edit3, Trash2, Volume2, Check, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface MessageActionBarProps {
  onCopy: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  onReadAloud?: () => void;
  onDelete?: () => void;
  onBranch?: () => void;
  isAI?: boolean;
  isTtsPlaying?: boolean;
}

export const MessageActionBar: React.FC<MessageActionBarProps> = ({
  onCopy,
  onRetry,
  onEdit,
  onReadAloud,
  onDelete,
  onBranch,
  isAI = true,
  isTtsPlaying = false
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`${styles.actionBarContainer} ${isAI ? styles.alignLeft : styles.alignRight}`}>
       <button 
         className={styles.iconBtn} 
         onClick={handleCopy} 
         title={t('agent.chat.copy', '复制内容')}
       >
          {copied ? <Check size={14} className={styles.copiedIcon} /> : <Copy size={14} />}
       </button>
       
        {isAI && onReadAloud && (
          <button 
            className={`${styles.iconBtn} ${isTtsPlaying ? styles.ttsPlaying : ''}`}
            onClick={onReadAloud} 
            title={t('agent.chat.readAloud', '语音朗读')}
          >
             <Volume2 size={14} />
          </button>
        )}

       {onEdit && (
         <button 
           className={styles.iconBtn} 
           onClick={onEdit} 
           title={t(isAI ? 'agent.chat.edit_ai' : 'agent.chat.edit', isAI ? '编辑AI回复' : '编辑我的消息')}
         >
            <Edit3 size={14} />
         </button>
       )}

       {onRetry && (
         <button 
           className={styles.iconBtn} 
           onClick={onRetry} 
           title={t('agent.chat.retry', '重新发送/生成')}
         >
            <RefreshCcw size={14} />
         </button>
       )}

       {isAI && onBranch && (
         <button 
           className={styles.iconBtn} 
           onClick={onBranch} 
           title={t('agent.chat.branch', '从此处创建分支')}
         >
            <GitBranch size={14} />
         </button>
       )}

       {onDelete && (
         <>
           <button 
             className={`${styles.iconBtn} ${styles.dangerBtn}`} 
             onClick={onDelete} 
             title={t('common.delete', '删除此条气泡')}
           >
              <Trash2 size={14} />
           </button>
         </>
       )}
    </div>
  );
};
