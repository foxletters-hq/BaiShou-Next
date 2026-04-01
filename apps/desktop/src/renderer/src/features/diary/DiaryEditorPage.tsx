import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiaryEditor, DiaryEditorAppBarTitle, MarkdownToolbar } from '@baishou/ui';
import { useNavigate, useParams } from 'react-router-dom';
import './DiaryEditorPage.css';

export const DiaryEditorPage: React.FC = () => {
  const { date } = useParams(); // 日期格式: YYYY-MM-DD
  const navigate = useNavigate();
  
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(date ? new Date(date) : new Date());
  const [weather, setWeather] = useState('');
  const [mood, setMood] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载日记数据 — 调用 diary:read IPC
  useEffect(() => {
    if (!date) return;
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('diary:read', date)
        .then((diary: any) => {
          if (diary) {
            setContent(diary.content || '');
            setTags(diary.tags || []);
            setWeather(diary.weather || '');
            setMood(diary.mood || '');
          }
        })
        .catch(console.error);
    }
  }, [date]);

  // 自动保存 (1.5秒节流)
  const autoSave = useCallback(async (newContent: string) => {
    setIsSaving(true);
    try {
      if (typeof window !== 'undefined' && window.electron) {
        await window.electron.ipcRenderer.invoke('diary:save', {
          date: selectedDate.toISOString().split('T')[0],
          content: newContent,
          tags,
          weather,
          mood
        });
      }
      setIsDirty(false);
    } finally {
      setIsSaving(false);
    }
  }, [selectedDate, tags, weather, mood]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => autoSave(newContent), 1500);
  };

  // 退出确认
  const handleBack = () => {
    if (isDirty) {
      if (confirm('有未保存的更改，确定要离开吗？')) {
        navigate(-1);
      }
    } else {
      navigate(-1);
    }
  };

  const handleSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await autoSave(content);
    navigate(-1);
  };

  return (
    <div className="diary-editor-page-container">
      <DiaryEditorAppBarTitle 
        date={selectedDate}
        onDateChange={setSelectedDate}
        weather={weather}
        mood={mood}
        onWeatherChange={setWeather}
        onMoodChange={setMood}
        isSaving={isSaving}
        onBack={handleBack}
      />
      <MarkdownToolbar onAction={(action) => {
        // 处理工具栏按钮：加粗/斜体/标题/列表等
      }} />
      <DiaryEditor 
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        onContentChange={handleContentChange}
        onTagsChange={(newTags) => { setTags(newTags); setIsDirty(true); }}
        onDateChange={setSelectedDate}
        onSave={handleSave}
        onCancel={handleBack}
      />
    </div>
  );
};
