import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiaryEditor } from '@baishou/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './DiaryEditorPage.css';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export const DiaryEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const { dateStr } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 是否是追加模式（原版 BaiShou append=1）
  const isAppendMode = searchParams.get('append') === '1';

  // 日期解析：严格使用 YYYY-MM-DD 手动构建避免时区问题（修复 RangeError）
  const parseDate = (str: string | undefined): Date => {
    if (!str || str === 'new') return new Date();
    // YYYY-MM-DD 格式
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseDate(dateStr));
  const [weather, setWeather] = useState('');
  const [mood, setMood] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [diaryId, setDiaryId] = useState<number | null>(null);

  const tagsRef = useRef<string[]>(tags);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  const [isLoading, setIsLoading] = useState(true);

  // ── 加载日记（原版 _loadDiary 逻辑）──────────────────────────────────
  // 根据日期查找已有日记，支持追加模式（appendOnLoad）
  useEffect(() => {
    if (!dateStr || dateStr === 'new') {
      const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n`;
      setContent(timeMark);
      setIsLoading(false);
      return;
    }

    if (typeof window !== 'undefined' && (window as any).api?.diary) {
      (window as any).api.diary.findByDate(dateStr)
        .then((diary: any) => {
          if (diary) {
            setDiaryId(diary.id || null);
            setTags(diary.tags || []);
            setWeather(diary.weather || '');
            setMood(diary.mood || '');

            if (isAppendMode) {
              const existing = (diary.content || '').trimEnd();
              const timeMark = `\n\n##### ${format(new Date(), 'HH:mm:ss')}\n\n`;
              setContent(existing + timeMark);
            } else {
              setContent(diary.content || '');
            }
          } else {
            const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n`;
            setContent(timeMark);
          }
        })
        .catch((e: any) => {
          console.error('Failed to load diary:', e);
          const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n`;
          setContent(timeMark);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, isAppendMode]);

  // ── 日期转 ISO 字符串（时区安全）──
  const dateToISOString = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}T00:00:00.000Z`;
  };

  // ── 保存（严格还原原版双分支逻辑）──────────────────────────────────────
  const autoSave = useCallback(async (newContent: string) => {
    if (!newContent.trim()) return;
    try {
      if (typeof window !== 'undefined' && (window as any).api?.diary) {
        let saveDateStr = dateStr;
        if (!saveDateStr || saveDateStr === 'new') {
          saveDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        }
        
        const payload = {
          date: dateToISOString(selectedDate),
          content: newContent,
          title: newContent.replace(/^#{1,6}\s*/gm, '').split('\n')[0].substring(0, 50),
          tags: tagsRef.current,
          weather,
          mood
        };

        if (diaryId) {
          await (window as any).api.diary.update(diaryId, payload);
        } else {
          const existing = await (window as any).api.diary.findByDate(saveDateStr);
          if (existing && existing.id) {
             // Merging content logic for newly found overlapping diary
            const oldContent = (existing.content || '').trimEnd();
            const mergedContent = oldContent ? `${oldContent}\n\n${newContent}` : newContent;
            const mergedTags = [...new Set([...(existing.tags || []), ...tagsRef.current])];
            await (window as any).api.diary.update(existing.id, {
              ...payload,
              content: mergedContent,
              tags: mergedTags,
            });
            setDiaryId(existing.id);
          } else {
            const created = await (window as any).api.diary.create(payload);
            if (created && created.id) setDiaryId(created.id);
          }
        }
      }
      setIsDirty(false);
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [selectedDate, weather, mood, diaryId, dateStr]);

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setIsDirty(true);
  };

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleBack = () => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      navigate(-1);
    }
  };

  const handleSave = async () => {
    // 延迟 100ms，以确保 TagInput 等失焦事件触发的 React 状态能完全更新到了 tagsRef
    setTimeout(async () => {
      await autoSave(content);
      navigate(-1);
    }, 100);
  };

  if (isLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <motion.div 
      className="diary-editor-page-container"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <DiaryEditor
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        onContentChange={handleContentChange}
        onTagsChange={(newTags) => { setTags(newTags); setIsDirty(true); }}
        onDateChange={(newDate) => { setSelectedDate(newDate); setIsDirty(true); }}
        onSave={handleSave}
        onCancel={handleBack}
      />

      {/* Delete/Exit Confirmation Modal (Reusing DB Delete Modal Styling) */}
      {showExitConfirm && (
        <div className="diary-delete-modal-overlay" onClick={() => setShowExitConfirm(false)}>
          <div className="diary-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-title">{t('common.confirm_leave', '确认离开')}</div>
            <div className="dd-modal-content" style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              {t('diary.editor_leave_confirm', '当前有尚未保存的文字，如果强行退出，将不会保存刚才键入的内容。确定要丢弃并离开吗？')}
            </div>
            <div className="dd-modal-actions" style={{ marginTop: '24px' }}>
              <button className="dd-btn-cancel" onClick={() => setShowExitConfirm(false)}>
                {t('common.cancel', '我再写写')}
              </button>
              <button className="dd-btn-confirm" onClick={() => navigate(-1)} style={{ background: '#ef4444', color: 'white' }}>
                {t('common.leave', '强行离开')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
