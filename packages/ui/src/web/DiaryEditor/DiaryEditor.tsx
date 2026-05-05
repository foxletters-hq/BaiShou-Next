import { useTranslation } from 'react-i18next';
import React from 'react';
import { MilkdownEditorWrapper } from './MilkdownEditor';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
import { TagInput } from '../TagInput';
import { WeatherPicker } from './WeatherPicker';
import './DiaryEditor.css';

interface DiaryEditorProps {
  content: string;
  tags: string[];
  selectedDate: Date;
  isSummaryMode?: boolean;
  weather?: string;
  mood?: string;
  isFavorite?: boolean;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateChange: (date: Date) => void;
  onWeatherChange?: (weather: string) => void;
  onMoodChange?: (mood: string) => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
  onSave?: (content: string, tags: string[], date: Date) => void;
  onCancel?: () => void;
}



export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  tags,
  selectedDate,
  isSummaryMode = false,
  weather = '',
  mood = '',
  isFavorite = false,
  onContentChange,
  onTagsChange,
  onDateChange,
  onWeatherChange,
  onMoodChange,
  onFavoriteChange,
  onSave,
  onCancel,
}) => {
  const { t } = useTranslation();

  /** 天气选项列表 */
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

  /** 心情选项列表 */
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

          {/* 元数据栏：天气、收藏 */}
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
            <MilkdownEditorWrapper
              content={content}
              onChange={(val) => { console.log('Milkdown onChange:', val); onContentChange(val || ''); }}
              placeholder={t('diary.editor_hint', '记录下这一刻...')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
