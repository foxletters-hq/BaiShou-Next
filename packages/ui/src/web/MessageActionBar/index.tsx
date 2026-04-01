import React, { useState } from 'react';
import styles from './MessageActionBar.module.css';
import { Copy, RefreshCcw, Edit3, Trash2, Volume2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface MessageActionBarProps {
  onCopy: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  onReadAloud?: () => void;
  onDelete?: () => void;
  isAI?: boolean;
}

export const MessageActionBar: React.FC<MessageActionBarProps> = ({
  onCopy,
  onRetry,
  onEdit,
  onReadAloud,
  onDelete,
  isAI = true
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
       <div className={styles.capsule}>
          <button 
            className={styles.iconBtn} 
            onClick={handleCopy} 
            title={t('agent.chat.copy', '复制内容')}
          >
             {copied ? <Check size={14} className={styles.copiedIcon} /> : <Copy size={14} />}
          </button>
          
          {isAI && onReadAloud && (
            <button 
              className={styles.iconBtn} 
              onClick={onReadAloud} 
              title={t('agent.chat.readAloud', '语音朗读')}
            >
               <Volume2 size={14} />
            </button>
          )}

          {!isAI && onEdit && (
            <button 
              className={styles.iconBtn} 
              onClick={onEdit} 
              title={t('agent.chat.edit', '编辑我的消息')}
            >
               <Edit3 size={14} />
            </button>
          )}

          {isAI && onRetry && (
            <button 
              className={styles.iconBtn} 
              onClick={onRetry} 
              title={t('agent.chat.retry', '让 AI 重新生成')}
            >
               <RefreshCcw size={14} />
            </button>
          )}

          {onDelete && (
            <>
              <div className={styles.divider} />
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
    </div>
  );
};
