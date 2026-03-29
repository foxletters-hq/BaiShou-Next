import React from 'react';
import styles from './MessageActionBar.module.css';

interface MessageActionBarProps {
  onCopy: () => void;
  onRetry?: () => void;
  onReadAloud?: () => void;
  onDelete?: () => void;
  isAI?: boolean;
}

export const MessageActionBar: React.FC<MessageActionBarProps> = ({
  onCopy,
  onRetry,
  onReadAloud,
  onDelete,
  isAI = true
}) => {
  return (
    <div className={`${styles.actionBar} ${isAI ? styles.alignLeft : styles.alignRight}`}>
       <button className={styles.actionBtn} onClick={onCopy} title="复制内容">
          📄 <span className={styles.btnText}>复制</span>
       </button>
       
       {isAI && onReadAloud && (
         <button className={styles.actionBtn} onClick={onReadAloud} title="语音朗读">
            🔊 <span className={styles.btnText}>朗读</span>
         </button>
       )}

       {isAI && onRetry && (
         <button className={styles.actionBtn} onClick={onRetry} title="重新生成">
            🔄 <span className={styles.btnText}>重试</span>
         </button>
       )}

       {onDelete && (
         <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={onDelete} title="删除消息">
            🗑️ <span className={styles.btnText}>删除</span>
         </button>
       )}
    </div>
  );
};
