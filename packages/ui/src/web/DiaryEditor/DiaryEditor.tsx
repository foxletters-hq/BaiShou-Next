import { useTranslation } from 'react-i18next';
import React from 'react';
import { MilkdownEditorWrapper } from './MilkdownEditor';
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle';
import { TagInput } from '../TagInput';
import './DiaryEditor.css';

interface DiaryEditorProps {
  content: string;
  tags: string[];
  selectedDate: Date;
  isSummaryMode?: boolean;
  weather?: string;
  mood?: string;
  location?: string;
  isFavorite?: boolean;
  onContentChange: (content: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateChange: (date: Date) => void;
  onWeatherChange?: (weather: string) => void;
  onMoodChange?: (mood: string) => void;
  onLocationChange?: (location: string) => void;
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
  location = '',
  isFavorite = false,
  onContentChange,
  onTagsChange,
  onDateChange,
  onWeatherChange,
  onMoodChange,
  onLocationChange,
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

          {/* 元数据栏：天气、心情、位置、收藏 */}
          {!isSummaryMode && (
            <div className="de-meta-bar">
              <select
                className="de-meta-select"
                value={weather}
                onChange={(e) => onWeatherChange?.(e.target.value)}
              >
                {WEATHER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <select
                className="de-meta-select"
                value={mood}
                onChange={(e) => onMoodChange?.(e.target.value)}
              >
                {MOOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <input
                className="de-meta-input"
                type="text"
                placeholder={`📍 ${t('diary.location', '位置')}`}
                value={location}
                onChange={(e) => onLocationChange?.(e.target.value)}
              />
              <button
                className={`de-meta-fav-btn${isFavorite ? ' active' : ''}`}
                onClick={() => onFavoriteChange?.(!isFavorite)}
                title={isFavorite ? t('diary.unfavorite', '取消收藏') : t('diary.favorite', '收藏')}
              >
                {isFavorite ? '★' : '☆'}
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
