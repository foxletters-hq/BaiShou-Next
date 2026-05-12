import { useTranslation } from 'react-i18next';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CodeMirrorEditor, CodeMirrorEditorHandle } from './CodeMirrorEditor';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
import { TagInput } from '../TagInput';
import { WeatherPicker } from './WeatherPicker';
import { DiaryAttachmentItem, getInsertMarkdown } from './AttachmentUploader';
import './DiaryEditor.css';

interface DiaryEditorProps {
  content: string;
  tags: string[];
  selectedDate: Date;
  isSummaryMode?: boolean;
  weather?: string;
  mood?: string;
  isFavorite?: boolean;
  mediaPaths?: string[];
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateChange: (date: Date) => void;
  onWeatherChange?: (weather: string) => void;
  onMoodChange?: (mood: string) => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
  onMediaPathsChange?: (mediaPaths: string[]) => void;
  onSave?: (content: string, tags: string[], date: Date) => void;
  onCancel?: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  weather = '',
  mood = '',
  isFavorite = false,
  mediaPaths = [],
  onContentChange,
  onTagsChange,
  onDateChange,
  onWeatherChange,
  onMoodChange,
  onFavoriteChange,
  onMediaPathsChange,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<DiaryAttachmentItem[]>([]);
  const [attachmentBasePath, setAttachmentBasePath] = useState('');
  const editorRef = useRef<CodeMirrorEditorHandle>(null);
  const mediaPathsRef = useRef(mediaPaths);

  useEffect(() => {
    mediaPathsRef.current = mediaPaths;
  }, [mediaPaths]);

  useEffect(() => {
    const fetchAttachmentDir = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).api?.diary) {
          const dateStr = [
            selectedDate.getFullYear(),
            String(selectedDate.getMonth() + 1).padStart(2, '0'),
            String(selectedDate.getDate()).padStart(2, '0'),
          ].join('-');
          const result = await (window as any).api.diary.getAttachmentDir(dateStr);
          if (result?.success && result.path) {
            setAttachmentBasePath(result.path);
          }
        }
      } catch (err) {
        console.error('Failed to get attachment dir:', err);
      }
    };
    fetchAttachmentDir();
  }, [selectedDate]);

  useEffect(() => {
    if (mediaPaths.length > 0) {
      const initialAttachments: DiaryAttachmentItem[] = mediaPaths.map((path, index) => ({
        id: `existing-${index}`,
        fileName: path.split('/').pop() || path,
        filePath: path,
        relativePath: path,
        isImage: /\.(png|jpe?g|gif|webp|bmp)$/i.test(path),
        isVideo: /\.(mp4|webm|ogg|mov)$/i.test(path),
        isAudio: /\.(mp3|wav|ogg|aac)$/i.test(path),
      }));
      setAttachments(initialAttachments);
    }
  }, [mediaPaths]);

  const handlePasteFiles = useCallback(async (files: File[]): Promise<string[]> => {
    const dateStr = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, '0'),
      String(selectedDate.getDate()).padStart(2, '0'),
    ].join('-');

    const attachmentInputs = await Promise.all(
      Array.from(files).map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          fileName: file.name,
          data: base64,
          mimeType: file.type,
        };
      }),
    );

    const results = await (window as any).api.diary.uploadAttachments({
      date: dateStr,
      attachments: attachmentInputs,
    });

    const markdowns: string[] = [];
    const newAttachments: DiaryAttachmentItem[] = [];

    results
      .filter((r: any) => r.success)
      .forEach((r: any) => {
        const att: DiaryAttachmentItem = {
          id: Math.random().toString(36).substring(7),
          fileName: r.fileName,
          filePath: r.filePath,
          relativePath: r.relativePath,
          isImage: /\.(png|jpe?g|gif|webp|bmp)$/i.test(r.fileName),
          isVideo: /\.(mp4|webm|ogg|mov)$/i.test(r.fileName),
          isAudio: /\.(mp3|wav|ogg|aac)$/i.test(r.fileName),
        };
        newAttachments.push(att);
        markdowns.push(getInsertMarkdown(att));
      });

    setAttachments((prev) => [...prev, ...newAttachments]);
    onMediaPathsChange?.([...mediaPathsRef.current, ...newAttachments.map((a) => a.relativePath)]);

    return markdowns;
  }, [selectedDate, onMediaPathsChange]);

  const WEATHER_OPTIONS = [
    { value: '', label: t('diary.weather.default', '天气') },
    { value: '晴', label: `☀️ ${t('diary.weather.sunny', '晴')}` },
    { value: '多云', label: `⛅ ${t('diary.weather.cloudy', '多云')}` },
    { value: '阴', label: `☁️ ${t('diary.weather.overcast', '阴')}` },
    { value: '小雨', label: `🌦️ ${t('diary.weather.light_rain', '小雨')}` },
    { value: '大雨', label: `🌧️ ${t('diary.weather.heavy_rain', '大雨')}` },
    { value: '雪', label: `❄️ ${t('diary.weather.snow', '雪')}` },
    { value: '雾', label: `🌫️ ${t('diary.weather.fog', '雾')}` },
    { value: '风', label: `💨 ${t('diary.weather.wind', '风')}` },
  ];

  const MOOD_OPTIONS = [
    { value: '', label: t('diary.mood.default', '心情') },
    { value: 'Happy', label: `😊 ${t('diary.mood.happy', '开心')}` },
    { value: 'Content', label: `😌 ${t('diary.mood.content', '满足')}` },
    { value: 'Peaceful', label: `🕊️ ${t('diary.mood.peaceful', '平静')}` },
    { value: 'Excited', label: `🤩 ${t('diary.mood.excited', '兴奋')}` },
    { value: 'Grateful', label: `🙏 ${t('diary.mood.grateful', '感恩')}` },
    { value: 'Reflective', label: `🤔 ${t('diary.mood.reflective', '沉思')}` },
    { value: 'Melancholy', label: `😢 ${t('diary.mood.melancholy', '忧伤')}` },
    { value: 'Anxious', label: `😰 ${t('diary.mood.anxious', '焦虑')}` },
    { value: 'Glorious', label: `🌟 ${t('diary.mood.glorious', '灿烂')}` },
  ];

  return (
    <div className="diary-editor-scaffold">
      <div className="de-app-bar">
        <button className="de-icon-btn" onClick={onCancel}>
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div className="de-app-bar-center">
          <DiaryEditorAppBarTitle
            isSummaryMode={isSummaryMode}
            selectedDate={selectedDate}
            onDateChanged={onDateChange}
          />
        </div>
        <div className="de-app-bar-actions">
          <button className="de-save-btn" onClick={() => onSave?.(content, tags, selectedDate)}>
            {t('common.save', '保存')}
          </button>
        </div>
      </div>

      <div className="de-body-column">
        <div className="de-expanded-list">
          {!isSummaryMode && (
            <div className="de-tags-section">
              <TagInput tags={tags} onChange={onTagsChange} />
            </div>
          )}

          {!isSummaryMode && (
            <div className="de-meta-bar">
              <WeatherPicker
                value={weather}
                options={WEATHER_OPTIONS}
                onChange={(v) => onWeatherChange?.(v)}
                placeholder={t('diary.weather.default', '天气')}
              />
              <button
                className={`de-meta-fav-btn${isFavorite ? ' active' : ''}`}
                onClick={() => onFavoriteChange?.(!isFavorite)}
                title={isFavorite ? t('diary.unfavorite', '取消收藏') : t('diary.favorite', '收藏')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
              </button>
            </div>
          )}

          <div className="de-content-section" data-color-mode="light">
            <CodeMirrorEditor
              ref={editorRef}
              content={content}
              onChange={(val) => onContentChange(val || '')}
              placeholder={t('diary.editor_hint', '记录下这一刻...')}
              basePath={attachmentBasePath}
              onPasteFiles={handlePasteFiles}
              onDropFiles={handlePasteFiles}
            />
          </div>


        </div>
      </div>
    </div>
  );
};
