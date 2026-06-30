import { useTranslation } from 'react-i18next'
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  WEATHER_IDS,
  weatherI18nKey,
  normalizeWeatherId,
  MOOD_IDS,
  getMoodLabelFallback,
  moodI18nKey,
  normalizeMoodId,
  type WeatherId
} from '@baishou/shared'
import { MOOD_FLUENT_ICON_SRC } from '../../shared/mood-fluent-assets'
import { WEATHER_FLUENT_ICON_SRC } from '../../shared/weather-fluent-assets'
import { CodeMirrorEditor, CodeMirrorEditorHandle } from './CodeMirrorEditor'
import { DiaryEditorAppBarTitle } from '../DiaryEditorAppBarTitle/DiaryEditorAppBarTitle'
import { DiaryMarkdownToolbar } from './DiaryMarkdownToolbar'
import { WeatherPicker } from './WeatherPicker'
import { DiaryAttachmentItem, getInsertMarkdown } from './AttachmentUploader'
import './DiaryEditor.css'

interface DiaryEditorProps {
  content: string
  selectedDate: Date
  isSummaryMode?: boolean
  weather?: string
  mood?: string
  isFavorite?: boolean
  mediaPaths?: string[]
  isSaving?: boolean
  onContentChange: (content: string) => void
  onDateChange: (date: Date) => void
  onWeatherChange?: (weather: string) => void
  onMoodChange?: (mood: string) => void
  onFavoriteChange?: (isFavorite: boolean) => void
  onMediaPathsChange?: (mediaPaths: string[]) => void
  onSave?: (content: string, date: Date) => void
  onCancel?: () => void
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export const DiaryEditor: React.FC<DiaryEditorProps> = ({
  content,
  selectedDate,
  isSummaryMode = false,
  weather = '',
  mood = '',
  isFavorite = false,
  mediaPaths = [],
  isSaving = false,
  onContentChange,
  onDateChange,
  onWeatherChange,
  onMoodChange,
  onFavoriteChange,
  onMediaPathsChange,
  onSave,
  onCancel
}) => {
  const { t } = useTranslation()
  const [attachments, setAttachments] = useState<DiaryAttachmentItem[]>([])
  const [attachmentBasePath, setAttachmentBasePath] = useState('')
  const editorRef = useRef<CodeMirrorEditorHandle>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [pickingImages, setPickingImages] = useState(false)
  const mediaPathsRef = useRef(mediaPaths)

  useEffect(() => {
    mediaPathsRef.current = mediaPaths
  }, [mediaPaths])

  useEffect(() => {
    const fetchAttachmentDir = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).api?.diary) {
          const dateStr = [
            selectedDate.getFullYear(),
            String(selectedDate.getMonth() + 1).padStart(2, '0'),
            String(selectedDate.getDate()).padStart(2, '0')
          ].join('-')
          const result = await (window as any).api.diary.getAttachmentDir(dateStr)
          if (result?.success && result.path) {
            setAttachmentBasePath(result.path)
          }
        }
      } catch (err) {
        console.error('Failed to get attachment dir:', err)
      }
    }
    fetchAttachmentDir()
  }, [selectedDate])

  useEffect(() => {
    if (mediaPaths.length > 0) {
      const initialAttachments: DiaryAttachmentItem[] = mediaPaths.map((path, index) => ({
        id: `existing-${index}`,
        fileName: path.split('/').pop() || path,
        filePath: path,
        relativePath: path,
        isImage: /\.(png|jpe?g|gif|webp|bmp)$/i.test(path),
        isVideo: /\.(mp4|webm|ogg|mov)$/i.test(path),
        isAudio: /\.(mp3|wav|ogg|aac)$/i.test(path)
      }))
      setAttachments(initialAttachments)
    }
  }, [mediaPaths])

  const handlePasteFiles = useCallback(
    async (files: File[]): Promise<string[]> => {
      const dateStr = [
        selectedDate.getFullYear(),
        String(selectedDate.getMonth() + 1).padStart(2, '0'),
        String(selectedDate.getDate()).padStart(2, '0')
      ].join('-')

      const attachmentInputs = await Promise.all(
        Array.from(files).map(async (file) => {
          const base64 = await fileToBase64(file)
          return {
            fileName: file.name,
            data: base64,
            mimeType: file.type
          }
        })
      )

      const results = await (window as any).api.diary.uploadAttachments({
        date: dateStr,
        attachments: attachmentInputs
      })

      const markdowns: string[] = []
      const newAttachments: DiaryAttachmentItem[] = []

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
            isAudio: /\.(mp3|wav|ogg|aac)$/i.test(r.fileName)
          }
          newAttachments.push(att)
          markdowns.push(getInsertMarkdown(att))
        })

      setAttachments((prev) => [...prev, ...newAttachments])
      onMediaPathsChange?.([...mediaPathsRef.current, ...newAttachments.map((a) => a.relativePath)])

      return markdowns
    },
    [selectedDate, onMediaPathsChange]
  )

  const weatherLabelFallback: Record<WeatherId, string> = {
    sunny: '晴',
    cloudy: '多云',
    overcast: '阴',
    light_rain: '小雨',
    heavy_rain: '大雨',
    snow: '雪',
    fog: '雾',
    windy: '风'
  }

  const WEATHER_OPTIONS = useMemo(
    () => [
      { value: '', label: t('diary.weather.default', '天气') },
      ...WEATHER_IDS.map((id) => ({
        value: id,
        iconSrc: WEATHER_FLUENT_ICON_SRC[id],
        label: t(`diary.weather.${weatherI18nKey(id)}`, weatherLabelFallback[id])
      }))
    ],
    [t]
  )

  const normalizedWeather = normalizeWeatherId(weather)

  useEffect(() => {
    if (normalizedWeather && normalizedWeather !== weather) {
      onWeatherChange?.(normalizedWeather)
    }
  }, [normalizedWeather, weather, onWeatherChange])

  const MOOD_OPTIONS = useMemo(
    () => [
      { value: '', label: t('diary.mood.default', '心情') },
      ...MOOD_IDS.map((id) => ({
        value: id,
        iconSrc: MOOD_FLUENT_ICON_SRC[id],
        label: t(`diary.mood.${moodI18nKey(id)}`, getMoodLabelFallback(id))
      }))
    ],
    [t]
  )

  const normalizedMood = normalizeMoodId(mood)

  useEffect(() => {
    if (normalizedMood && normalizedMood !== mood) {
      onMoodChange?.(normalizedMood)
    }
  }, [normalizedMood, mood, onMoodChange])

  const handleInsertText = useCallback((prefix: string, suffix = '') => {
    editorRef.current?.insertWrappedText(prefix, suffix)
  }, [])

  const handleUndo = useCallback(() => {
    editorRef.current?.undo()
  }, [])

  const handleRedo = useCallback(() => {
    editorRef.current?.redo()
  }, [])

  const handleToggleMark = useCallback((marker: '**' | '*' | '`' | '~~') => {
    editorRef.current?.toggleMarkdownMark(marker)
  }, [])

  const handlePickImages = useCallback(() => {
    imageInputRef.current?.click()
  }, [])

  const handleImageInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      event.target.value = ''
      if (!files.length) return

      setPickingImages(true)
      try {
        const markdowns = await handlePasteFiles(files)
        if (!markdowns.length) return
        const block = `${markdowns.length > 1 ? '\n\n' : ''}${markdowns.join('\n\n')}\n`
        editorRef.current?.insertAtCursor(block)
      } finally {
        setPickingImages(false)
      }
    },
    [handlePasteFiles]
  )

  return (
    <div className="diary-editor-scaffold">
      <div className="de-app-bar">
        <button className="de-icon-btn" onClick={onCancel}>
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div className="de-app-bar-center">
          <DiaryEditorAppBarTitle
            isSummaryMode={isSummaryMode}
            selectedDate={selectedDate}
            onDateChanged={onDateChange}
          />
        </div>
        <div className="de-app-bar-actions">
          <button
            className="de-save-btn"
            onClick={() => onSave?.(content, selectedDate)}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="de-save-loading">
                <span className="de-spinner" />
                {t('common.saving', '保存中...')}
              </span>
            ) : (
              t('common.save', '保存')
            )}
          </button>
        </div>
      </div>

      <div className="de-body-column">
        <div className="de-expanded-list">
          {!isSummaryMode && (
            <div className="de-meta-bar">
              <div className="de-meta-pickers">
                {onWeatherChange && (
                  <WeatherPicker
                    value={normalizedWeather}
                    options={WEATHER_OPTIONS}
                    onChange={(v) => onWeatherChange(v)}
                    placeholder={t('diary.weather.default', '天气')}
                  />
                )}
                {onMoodChange && (
                  <WeatherPicker
                    value={normalizedMood}
                    options={MOOD_OPTIONS}
                    onChange={(v) => onMoodChange(v)}
                    placeholder={t('diary.mood.default', '心情')}
                  />
                )}
              </div>
              <button
                className={`de-meta-fav-btn${isFavorite ? ' active' : ''}`}
                onClick={() => onFavoriteChange?.(!isFavorite)}
                title={isFavorite ? t('diary.unfavorite', '取消收藏') : t('diary.favorite', '收藏')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill={isFavorite ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
              placeholder={t('diary.tag_editor_hint', '首行输入 #标签 后按回车，再写正文…')}
              basePath={attachmentBasePath}
              onPasteFiles={handlePasteFiles}
              onDropFiles={handlePasteFiles}
            />
            {!isSummaryMode && (
              <>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(event) => void handleImageInputChange(event)}
                />
                <DiaryMarkdownToolbar
                  onInsertText={handleInsertText}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onToggleMark={handleToggleMark}
                  onPickImages={handlePickImages}
                  pickingImages={pickingImages}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
