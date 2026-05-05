import React, { useState, useRef, useEffect, useImperativeHandle } from 'react';
import styles from './InputBar.module.css';
import type { MockChatAttachment } from '@baishou/shared';

import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast/useToast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Paperclip, Zap, Wrench, Globe, BookOpen, 
  FileText, Folder, X, ArrowUp, LayoutGrid, Menu, Square 
} from 'lucide-react';
import { MdSend, MdStop, MdApps } from 'react-icons/md';

export interface InputBarProps {
  isLoading: boolean;
  onSend: (text: string, attachments?: MockChatAttachment[], searchMode?: boolean) => void;
  onStop?: () => void;
  assistantName?: string;
  onAssistantTap?: () => void;
  onRecall?: () => void;
  onTriggerShortcut?: () => void;
  onManageShortcuts?: () => void;
  onOpenTools?: () => void;
  searchMode?: boolean;
  onToggleSearchMode?: () => void;
}

export interface InputBarRef {
  insertText: (text: string) => void;
  focus: () => void;
}

export const InputBar = React.forwardRef<InputBarRef, InputBarProps>(({
  isLoading,
  onSend,
  onStop,
  assistantName,
  onAssistantTap,
  onRecall,
  onTriggerShortcut,
  onManageShortcuts,
  onOpenTools,
  searchMode = false,
  onToggleSearchMode
}, ref) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MockChatAttachment[]>([]);
  const [showToolbar, setShowToolbar] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('baishou_toolbar_open') === 'true';
    }
    return false;
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  useImperativeHandle(ref, () => ({
    insertText: (newText) => {
      setText((prev) => prev ? `${prev}\n${newText}` : newText);
      setTimeout(() => {
        if (textareaRef.current) textareaRef.current.focus();
      }, 0);
    },
    focus: () => {
      if (textareaRef.current) textareaRef.current.focus();
    }
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 144)}px`; // approx 6 lines
    }
  }, [text]);

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading) return;
    onSend(text.trim(), attachments.length > 0 ? [...attachments] : undefined, searchMode);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePickFiles = async () => {
    // Phase 10: Use Electron Native `dialog` if available
    // @ts-ignore
    if (typeof window !== 'undefined' && window.api && window.api.pickFiles) {
      try {
        // @ts-ignore
        const newAtts = await window.api.pickFiles();
        if (newAtts && newAtts.length > 0) {
          setAttachments(prev => [...prev, ...newAtts]);
        }
      } catch (e) {
        console.error('Failed to pick file via IPC:', e);
      }
      return;
    }

    // Fallback: Web standard <input type="file" />
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleNativeWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    // Simulate reading via standard Web File API and converting to MockChatAttachment
    // Note: In a complete implementation we might read Blob/DataURL
    const newAtts = Array.from(e.target.files).map(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      return {
        id: Math.random().toString(36).substring(7),
        fileName: file.name,
        filePath: URL.createObjectURL(file), // create local blob string to display
        isImage,
        isPdf,
        fileSize: file.size
      };
    });

    setAttachments(prev => [...prev, ...newAtts]);
    // Reset file input
    e.target.value = '';
  };

  const handleOpenToolManager = () => {
    toast.showSuccess(t('agent.tools.tool_call') + ' Manager Triggered');
  };

  const handlePromptShortcut = () => {
    if (onManageShortcuts) {
      onManageShortcuts();
    } else if (onTriggerShortcut) {
      onTriggerShortcut();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    
    // Trigger shortcut modal if '/' is just typed
    if (val.endsWith('/') && val.length > text.length) {
       if (onTriggerShortcut) onTriggerShortcut();
    }
    setText(val);
  };

  const toggleSearchMode = () => onToggleSearchMode?.();

  const QuickActionChip = ({ icon, label, onClick, isActive = false }: { icon: React.ReactNode, label: string, onClick?: () => void, isActive?: boolean }) => (
    <button 
      className={`${styles.quickActionChip} ${isActive ? styles.chipActive : ''}`} 
      onClick={onClick} 
      type="button"
    >
      <span className={styles.chipIcon}>{icon}</span>
      <span className={styles.chipLabel}>{label}</span>
    </button>
  );

  return (
    <div className={styles.containerMask}>
      <input 
        type="file" 
        multiple 
        ref={fileInputRef} 
        onChange={handleNativeWebFileChange}
        style={{ display: 'none' }}
      />
      <div className={styles.constrainedBox}>
        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className={styles.attachmentList}>
             {attachments.map(att => (
                <div key={att.id} className={styles.attachmentChip}>
                   {att.isImage ? (
                     <img src={att.filePath} className={styles.attPreviewImg} alt={att.fileName}/>
                   ) : (
                     <div className={styles.attFileBox}>
                       <span className={styles.attFileIcon}>{att.isPdf ? <FileText size={18} /> : <Folder size={18} />}</span>
                       <div className={styles.attFileMeta}>
                          <span className={styles.attFileName}>{att.fileName}</span>
                          <span className={styles.attFileSize}>{att.fileSize ? (att.fileSize < 1024 * 1024 ? `${(att.fileSize / 1024).toFixed(1)} KB` : `${(att.fileSize / 1024 / 1024).toFixed(1)} MB`) : '124 KB'}</span>
                       </div>
                     </div>
                   )}
                   <button 
                     className={styles.attRemoveBtn} 
                     onClick={() => setAttachments(prev => prev.filter(p => p.id !== att.id))}
                   >
                     <X size={12} strokeWidth={3} />
                   </button>
                </div>
             ))}
          </div>
        )}

        {/* Animated Toolbar */}
        <AnimatePresence initial={false}>
          {showToolbar && (
            <motion.div 
              className={styles.toolbarWrapper}
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginBottom: 2 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
               <div className={styles.toolbarScroll}>
                  <QuickActionChip icon={<Paperclip size={14} />} label={t('input.upload_attachment', '上传附件')} onClick={handlePickFiles} />
                  <QuickActionChip icon={<Zap size={14} />} label={t('input.shortcut_command', '快捷指令')} onClick={handlePromptShortcut} />
                  <QuickActionChip icon={<Wrench size={14} />} label={t('agent.tools.tool_call')} onClick={onOpenTools || handleOpenToolManager} />
                  <QuickActionChip 
                    icon={searchMode ? <Globe size={14} /> : <span style={{opacity: 0.5}}><Globe size={14} /></span>} 
                    label={searchMode ? t('settings.web_search_mode_tool') : t('settings.web_search_mode_off')} 
                    isActive={searchMode} 
                    onClick={toggleSearchMode} 
                  />
                  {onRecall && (
                    <QuickActionChip icon={<BookOpen size={14} />} label={t('settings.recall_memories')} onClick={onRecall} />
                  )}
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Card */}
        <div className={styles.inputCard}>
           <button 
             className={styles.appMenuBtn} 
             onClick={() => setShowToolbar(prev => {
                const next = !prev;
                if (typeof window !== 'undefined') {
                   localStorage.setItem('baishou_toolbar_open', String(next));
                }
                return next;
             })}
             type="button"
           >
              {showToolbar ? <LayoutGrid size={20} /> : <Menu size={20} />}
           </button>

           <div className={styles.inputWrapper}>
             <textarea
               ref={textareaRef}
               className={styles.textarea}
               placeholder={t('agent.chat.input_hint')}
               value={text}
               onChange={handleTextChange}
               onKeyDown={handleKeyDown}
               rows={1}
             />
           </div>

           <div className={styles.sendBtnWrapper}>
              {isLoading ? (
                <motion.button 
                  className={`${styles.actionBtn} ${styles.stopBtn}`} 
                  onClick={onStop} 
                  type="button"
                  whileTap={{ scale: 0.92 }}
                >
                   <MdStop size={20} />
                </motion.button>
              ) : (
                <motion.button 
                   className={`${styles.actionBtn} ${styles.sendBtn} ${(!text.trim() && attachments.length === 0) ? styles.sendBtnDisabled : ''}`} 
                   onClick={handleSend}
                   disabled={!text.trim() && attachments.length === 0}
                   type="button"
                   whileTap={{ scale: 0.92 }}
                >
                   <MdSend size={18} />
                </motion.button>
              )}
           </div>
        </div>
      </div>
    </div>
  );
});

InputBar.displayName = 'InputBar';
