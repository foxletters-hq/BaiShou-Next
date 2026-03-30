import React, { useState, useRef, useEffect } from 'react';
import styles from './InputBar.module.css';
import { MockChatAttachment } from '@baishou/shared/src/mock/agent.mock';

// TODO: [Agent1-Dependency] i18n
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => {
    const dict: Record<string, string> = {
      'agent.tools.tool_call': '工具调用',
      'settings.web_search_mode_off': '搜索关闭',
      'settings.web_search_mode_tool': '深度搜索',
      'settings.recall_memories': '记忆唤醒',
      'agent.chat.input_hint': '输入消息...',
    };
    return dict[key] || key;
  },
});

export interface InputBarProps {
  isLoading: boolean;
  onSend: (text: string, attachments?: MockChatAttachment[]) => void;
  onStop?: () => void;
  assistantName?: string;
  onAssistantTap?: () => void;
  onRecall?: () => void;
}

export const InputBar: React.FC<InputBarProps> = ({
  isLoading,
  onSend,
  onStop,
  assistantName,
  onAssistantTap,
  onRecall,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([]);
  const [showToolbar, setShowToolbar] = useState(true);
  const [searchMode, setSearchMode] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`; // approx 6 lines
    }
  }, [text]);

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading) return;
    onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined);
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

  // 1. Tool Bar Chips
  const handlePickFiles = () => {
    // Mocking file picker
    const newAtt: MockChatAttachment = {
      id: Math.random().toString(36).substring(7),
      fileName: 'mock_file.pdf',
      filePath: '/mock_file.pdf',
      isImage: false,
      isPdf: true,
    };
    setAttachments(prev => [...prev, newAtt]);
  };

  const handleOpenToolManager = () => {
    // TODO: [Agent2/3 Dependency] Dialog
    alert('Open Tool Manager');
  };

  const handlePromptShortcut = () => {
    // TODO: PromptShortcutSheet
    const sample = '帮我解释一下...';
    setText(prev => prev + sample);
  };

  const toggleSearchMode = () => setSearchMode(prev => !prev);

  const QuickActionChip = ({ icon, label, onClick, isActive = false }: { icon: string, label: string, onClick?: () => void, isActive?: boolean }) => (
    <button className={`${styles.quickActionChip} ${isActive ? styles.chipActive : ''}`} onClick={onClick} type="button">
      <span className={styles.chipIcon}>{icon}</span>
      <span className={styles.chipLabel}>{label}</span>
    </button>
  );

  return (
    <div className={styles.containerMask}>
      <div className={styles.constrainedBox}>
        {/* Animated Toolbar */}
        <div className={`${styles.toolbarWrapper} ${showToolbar ? styles.toolbarVisible : ''}`}>
           <div className={styles.toolbarScroll}>
              <QuickActionChip icon="📎" label="上传附件" onClick={handlePickFiles} />
              <QuickActionChip icon="⚡" label="快捷指令" onClick={handlePromptShortcut} />
              <QuickActionChip icon="🧩" label={t('agent.tools.tool_call')} onClick={handleOpenToolManager} />
              <QuickActionChip 
                icon={searchMode ? "🌐" : "🚫"} 
                label={searchMode ? t('settings.web_search_mode_tool') : t('settings.web_search_mode_off')} 
                isActive={searchMode} 
                onClick={toggleSearchMode} 
              />
              {onRecall && (
                <QuickActionChip icon="📖" label={t('settings.recall_memories')} onClick={onRecall} />
              )}
           </div>
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className={styles.attachmentList}>
             {attachments.map(att => (
                <div key={att.id} className={styles.attachmentChip}>
                   {att.isImage ? (
                     <img src={att.filePath} className={styles.attPreviewImg} alt={att.fileName}/>
                   ) : (
                     <div className={styles.attFileBox}>
                       <span className={styles.attFileIcon}>{att.isPdf ? '📄' : '📁'}</span>
                       <div className={styles.attFileMeta}>
                          <span className={styles.attFileName}>{att.fileName}</span>
                          <span className={styles.attFileSize}>124 KB</span>
                       </div>
                     </div>
                   )}
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

        {/* Input Card */}
        <div className={styles.inputCard}>
           <button 
             className={styles.appMenuBtn} 
             onClick={() => setShowToolbar(!showToolbar)}
             type="button"
           >
              {showToolbar ? '▦' : '▤'}
           </button>

           <div className={styles.inputWrapper}>
             <textarea
               ref={textareaRef}
               className={styles.textarea}
               placeholder={t('agent.chat.input_hint')}
               value={text}
               onChange={(e) => setText(e.target.value)}
               onKeyDown={handleKeyDown}
               rows={1}
             />
           </div>

           <div className={styles.sendBtnWrapper}>
              {isLoading ? (
                <button className={`${styles.actionBtn} ${styles.stopBtn}`} onClick={onStop} type="button">
                   <div className={styles.stopSquare}></div>
                </button>
              ) : (
                <button 
                   className={`${styles.actionBtn} ${styles.sendBtn} ${(!text.trim() && attachments.length === 0) ? styles.sendBtnDisabled : ''}`} 
                   onClick={handleSend}
                   disabled={!text.trim() && attachments.length === 0}
                   type="button"
                >
                   ➤
                </button>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};
