import React, { useState, useEffect, useRef } from 'react';
import { DiaryEditor } from '@baishou/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2 } from 'lucide-react';
import './DiaryEditorPage.css';

type SyncState = 'idle' | 'saving' | 'saved';

export const DiaryEditorPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Vibe State: Sync Visualization
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  
  // debounced autosave ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 模拟从 Zustand 或 SQLite 中拉取锚点历史
    if (id) {
       setContent('这本日记被重新捞取而出...\n\n# 记忆断签');
       setTags(['开发', '日常']);
    }
  }, [id]);

  const triggerRealSave = (newContent: string, currentTags: string[], date: Date) => {
    setSyncState('saving');
    // Simulate real local store / IPC call delay
    setTimeout(() => {
       console.log('Diary Payload Saved:', { newContent, currentTags, date });
       setSyncState('saved');
       
       const now = new Date();
       setLastSavedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
       
       // Revert UI to idle after 2s
       setTimeout(() => setSyncState('idle'), 2000);
    }, 600); 
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    
    // Core AutoSave Throttle/Debounce Implementation
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSyncState('idle');

    saveTimeoutRef.current = setTimeout(() => {
      triggerRealSave(newContent, tags, selectedDate);
    }, 1500); // 停止打字 1.5秒后静默保存
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    triggerRealSave(content, newTags, selectedDate);
  };

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    triggerRealSave(content, tags, newDate);
  };

  const handleSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    triggerRealSave(content, tags, selectedDate);
    // 可选：手工按 Save 按钮后强制拦截并退出
    navigate(-1);
  };

  return (
    <div className="diary-editor-page-container">
      
      <AnimatePresence>
         {syncState !== 'idle' && (
            <motion.div 
               className="auto-save-toast"
               initial={{ opacity: 0, y: -20, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               exit={{ opacity: 0, y: -20, scale: 0.95 }}
               transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
               {syncState === 'saving' ? (
                  <>
                    <Loader2 size={16} className="toast-icon toast-spin" />
                    <span>正在固化神经链路...</span>
                  </>
               ) : (
                  <>
                    <CheckCircle2 size={16} className="toast-icon toast-success" />
                    <span>已同步至深空域 ({lastSavedTime})</span>
                  </>
               )}
            </motion.div>
         )}
      </AnimatePresence>

      <DiaryEditor 
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        onContentChange={handleContentChange}
        onTagsChange={handleTagsChange}
        onDateChange={handleDateChange}
        onSave={handleSave}
        onCancel={() => {
           // If user force exits, we do one final sync
           if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
              triggerRealSave(content, tags, selectedDate);
           }
           navigate(-1);
        }}
      />
    </div>
  );
};
