import React, { useState, useRef, useEffect } from 'react';
import styles from './InputBar.module.css';

interface Attachment {
  id: string;
  name: string;
  url: string;
}

interface InputBarProps {
  onSend: (text: string, attachments: Attachment[]) => void;
  onStop?: () => void;
  isLoading?: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend, onStop, isLoading }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showToolbar, setShowToolbar] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading) return;
    onSend(text, attachments);
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const QuickActionChip = ({ icon, label, onClick, isActive }: { icon: string, label: string, onClick?: () => void, isActive?: boolean }) => (
    <div className={`${styles.quickActionChip} ${isActive ? styles.active : ''}`} onClick={onClick}>
      <span className={styles.chipIcon}>{icon}</span>
      <span className={styles.chipLabel}>{label}</span>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Quick Actions Toolbar */}
      <div className={`${styles.toolbarWrapper} ${showToolbar ? styles.toolbarVisible : styles.toolbarHidden}`}>
        <div className={styles.toolbarScroll}>
          <QuickActionChip icon="📎" label="上传附件" />
          <QuickActionChip icon="⚡" label="快捷指令" />
          <QuickActionChip icon="🔧" label="工具调用" />
          <QuickActionChip icon="🔎" label="深度搜索" isActive={false} />
          <QuickActionChip icon="📖" label="记忆唤醒" />
        </div>
      </div>

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className={styles.attachmentPreviewArea}>
           {attachments.map(att => (
             <div key={att.id} className={styles.attachmentChip}>
                <span className={styles.attIcon}>📄</span>
                <span className={styles.attName}>{att.name}</span>
                <button 
                  className={styles.attRemoveBtn} 
                  onClick={() => setAttachments(prev => prev.filter(p => p.id !== att.id))}
                >
                  ×
                </button>
             </div>
           ))}
        </div>
      )}

      {/* Main Input Box */}
      <div className={styles.inputCard}>
        <button 
          className={styles.toggleToolbarBtn} 
          onClick={() => setShowToolbar(!showToolbar)}
          title="切换快捷栏"
        >
           {showToolbar ? '▦' : '▤'}
        </button>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="问点什么... (Enter 发送)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <div className={styles.actionBtnContainer}>
          {isLoading ? (
            <button className={`${styles.sendBtn} ${styles.stopBtn}`} onClick={onStop}>
              <span className={styles.stopIcon}>■</span>
            </button>
          ) : (
            <button className={styles.sendBtn} onClick={handleSend} disabled={!text.trim() && attachments.length === 0}>
               <span className={styles.sendIcon}>➤</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
