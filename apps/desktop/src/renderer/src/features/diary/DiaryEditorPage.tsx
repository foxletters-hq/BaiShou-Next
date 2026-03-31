import React, { useState, useEffect, useRef } from 'react';
import { DiaryEditor } from '@baishou/ui';
import { useNavigate, useParams } from 'react-router-dom';
import './DiaryEditorPage.css';

export const DiaryEditorPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // debounced autosave ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 模拟数据获取
    if (id) {
       setContent('以前写过的一段文字...\n\n# 新的见解');
       setTags(['开发', '代理']);
    }
  }, [id]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // 简单的防抖保存逻辑 - 2秒无操作自动保存
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      console.log('Auto-saving diary...', newContent);
      // TODO: Connect to SQLite / Zustand
    }, 2000);
  };

  const handleSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    console.log('Manual save:', { content, tags, selectedDate });
    navigate(-1);
  };

  return (
    <div className="diary-editor-page-container">
      <DiaryEditor 
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        onContentChange={handleContentChange}
        onTagsChange={setTags}
        onDateChange={setSelectedDate}
        onSave={handleSave}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
};
