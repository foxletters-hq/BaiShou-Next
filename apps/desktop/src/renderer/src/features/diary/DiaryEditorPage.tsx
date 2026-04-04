import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiaryEditor } from '@baishou/ui';
import { useNavigate, useParams } from 'react-router-dom';
import './DiaryEditorPage.css';
import { useTranslation } from 'react-i18next';


export const DiaryEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const { dateStr } = useParams();
  const navigate = useNavigate();
  
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const _initDate = (dateStr && dateStr !== 'new') ? new Date(dateStr) : new Date();
  const [selectedDate, setSelectedDate] = useState(isNaN(_initDate.getTime()) ? new Date() : _initDate);
  const [weather, setWeather] = useState('');
  const [mood, setMood] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [diaryId, setDiaryId] = useState<number | null>(null);
  
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 加载日记数据 — 调用 diary:findByDate IPC
  useEffect(() => {
  if (!dateStr || dateStr === 'new') return;
    if (typeof window !== 'undefined' && (window as any).api?.diary) {
      (window as any).api.diary.findByDate(dateStr)
        .then((diary: any) => {
          if (diary) {
            setDiaryId(diary.id || null);
            setContent(diary.content || '');
            setTags(diary.tags || []);
            setWeather(diary.weather || '');
            setMood(diary.mood || '');
          }
        })
        .catch(console.error);
    }
  }, [dateStr]);

  // 自动保存 (1.5秒节流)
  const autoSave = useCallback(async (newContent: string) => {
    try {
      if (typeof window !== 'undefined' && (window as any).api?.diary) {
        const payload = {
          date: new Date(selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000).toISOString().split('T')[0] + 'T00:00:00.000Z',
          content: newContent,
          title: newContent.split('\n')[0].substring(0, 50),
          tags,
          weather,
          mood
        };
        if (diaryId) {
          await (window as any).api.diary.update(diaryId, payload);
        } else {
          const created = await (window as any).api.diary.create(payload);
          if (created && created.id) setDiaryId(created.id);
        }
      }
      setIsDirty(false);
    } catch (e) {
      console.error(e);
    }
  }, [selectedDate, tags, weather, mood, diaryId]);

  const handleContentChange = (newContent: string) => {
  setContent(newContent);
    setIsDirty(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => autoSave(newContent), 1500);
  };

  // 退出确认
  const handleBack = () => {
  if (isDirty) {
      if (confirm(t('diary.editor_leave_confirm', '尚有未保存的更改，确定要弃用并离开吗？'))) {
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
      <DiaryEditor 
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        onContentChange={handleContentChange}
        onTagsChange={(newTags) => {

 setTags(newTags); setIsDirty(true); }}
        onDateChange={setSelectedDate}
        onSave={handleSave}
        onCancel={handleBack}
      />
    </div>
  );
};
