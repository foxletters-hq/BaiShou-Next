import React, { useState, useEffect, useRef, useCallback } from 'react'
import { DiaryEditor, useToast } from '@baishou/ui'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import './DiaryEditorPage.css'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { formatLocalDate, normalizeWeatherId, safeParseDate } from '@baishou/shared'
import {
  DIARY_EDITOR_SAVE_EXIT_TRANSITION,
  markDiaryReturnReveal
} from './diary-navigation'

export const DiaryEditorPage: React.FC = () => {
  const { t } = useTranslation()
  const { dateStr } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  // 是否是追加模式（仅在通过首页快捷按钮点击时带 append=1 参数才生效，不要直接点开今天的日记卡片也强制加时间）
  const isAppendMode = searchParams.get('append') === '1'

  // 日期解析：优先取 URL dateStr 参数，新建模式下取 ?date= query param，兜底取今天
  const parseInitialDate = (): Date => {
    if (!dateStr || dateStr === 'new') {
      const dParam = searchParams.get('date')
      return safeParseDate(dParam ?? undefined)
    }
    return safeParseDate(dateStr)
  }

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseInitialDate())
  const [weather, setWeather] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [diaryId, setDiaryId] = useState<number | null>(null)
  const [mediaPaths, setMediaPaths] = useState<string[]>([])
  const tagsRef = useRef<string[]>(tags)
  useEffect(() => {
    tagsRef.current = tags
  }, [tags])

  const [isLoading, setIsLoading] = useState(true)
  const initialStateRef = useRef<{
    content: string
    tags: string[]
    selectedDate: Date
    weather: string
    isFavorite: boolean
    mediaPaths: string[]
  } | null>(null)

  // ── 加载日记（原版 _loadDiary 逻辑）──────────────────────────────────
  // 根据日期查找已有日记，支持追加模式（appendOnLoad）
  useEffect(() => {
    if (!dateStr || dateStr === 'new') {
      const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
      setContent(timeMark)
      initialStateRef.current = {
        content: timeMark,
        tags: [],
        selectedDate: parseInitialDate(),
        weather: '',
        isFavorite: false,
        mediaPaths: []
      }
      setIsLoading(false)
      return
    }

    if (typeof window !== 'undefined' && (window as any).api?.diary) {
      ;(window as any).api.diary
        .findByDate(dateStr)
        .then((diary: any) => {
          let initialContent = ''
          let initialTags: string[] = []
          let initialWeather = ''
          let initialFavorite = false
          let initialMedia: string[] = []

          if (diary) {
            setDiaryId(diary.id || null)
            setTags(diary.tags || [])
            setWeather(normalizeWeatherId(diary.weather || '') || '')
            setIsFavorite(diary.isFavorite || false)
            setMediaPaths(diary.mediaPaths || [])

            initialTags = diary.tags || []
            initialWeather = normalizeWeatherId(diary.weather || '') || ''
            initialFavorite = diary.isFavorite || false
            initialMedia = diary.mediaPaths || []

            if (isAppendMode) {
              const existing = (diary.content || '').trimEnd()
              const timeMark = `\n\n##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
              initialContent = existing ? existing + timeMark : timeMark.trimStart()
            } else {
              initialContent = diary.content || ''
            }
          } else {
            initialContent = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
          }

          setContent(initialContent)
          initialStateRef.current = {
            content: initialContent,
            tags: initialTags,
            selectedDate: parseInitialDate(),
            weather: initialWeather,
            isFavorite: initialFavorite,
            mediaPaths: initialMedia
          }
        })
        .catch((e: any) => {
          console.error('Failed to load diary:', e)
          const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
          setContent(timeMark)
          initialStateRef.current = {
            content: timeMark,
            tags: [],
            selectedDate: parseInitialDate(),
            weather: '',
            isFavorite: false,
            mediaPaths: []
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, isAppendMode])

  // ── 保存（严格还原原版双分支逻辑）──────────────────────────────────────
  const autoSave = useCallback(
    async (newContent: string) => {
      if (!newContent.trim() && !diaryId) return
      try {
        if (typeof window !== 'undefined' && (window as any).api?.diary) {
          // 统一使用 UTC 日期字符串，与后端 IPC new Date(dateStr) 的解析行为保持一致
          // 使用本地时区 YYYY-MM-DD，与后端 IPC parseDateStr 成对
          const selectedDateStr = formatLocalDate(selectedDate)

          const payload = {
            date: selectedDateStr, // YYYY-MM-DD 纯日期字符串
            content: newContent,
            title: newContent
              .replace(/^#{1,6}\s*/gm, '')
              .split('\n')[0]
              .substring(0, 50),
            tags: tagsRef.current,
            weather,
            isFavorite,
            mediaPaths
          }

          // 统一使用下沉到 DiaryService 中的 save 接口，自动处理新建、更新与冲突自动合并
          const saved = await (window as any).api.diary.save(diaryId, payload)
          if (saved && saved.id && saved.id !== diaryId) {
            setDiaryId(saved.id)
          }
          return saved
        }
        setIsDirty(false)
        initialStateRef.current = {
          content: newContent,
          tags: tagsRef.current,
          selectedDate,
          weather,
          isFavorite,
          mediaPaths
        }
      } catch (e: any) {
        console.error('Save failed:', e)
        throw e
      }
    },
    [selectedDate, weather, isFavorite, diaryId]
  )

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setIsDirty(true)
  }

  const checkIsReallyDirty = (): boolean => {
    if (!initialStateRef.current) return false
    const init = initialStateRef.current

    if (content !== init.content) return true
    if (weather !== init.weather) return true
    if (isFavorite !== init.isFavorite) return true
    if (formatLocalDate(selectedDate) !== formatLocalDate(init.selectedDate)) return true

    const currentTagsSorted = [...tags].sort().join(',')
    const initTagsSorted = [...init.tags].sort().join(',')
    if (currentTagsSorted !== initTagsSorted) return true

    const currentMediaSorted = [...mediaPaths].sort().join(',')
    const initMediaSorted = [...init.mediaPaths].sort().join(',')
    if (currentMediaSorted !== initMediaSorted) return true

    return false
  }

  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLeavingAfterSave, setIsLeavingAfterSave] = useState(false)
  const leavingAfterSaveRef = useRef(false)

  const handleBack = () => {
    if (checkIsReallyDirty()) {
      setShowExitConfirm(true)
    } else {
      goBackToSidebar()
    }
  }

  const goBackToSidebar = useCallback(() => {
    const lastNav = sessionStorage.getItem('desktop_last_nav')
    if (lastNav && lastNav !== '/diary') {
      navigate(lastNav)
    } else {
      navigate('/diary')
    }
  }, [navigate])

  const playSaveExitAndGoBack = useCallback(() => {
    markDiaryReturnReveal()
    leavingAfterSaveRef.current = true
    setIsLeavingAfterSave(true)
  }, [])

  const handleSaveExitComplete = () => {
    if (!leavingAfterSaveRef.current) return
    leavingAfterSaveRef.current = false
    goBackToSidebar()
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    // 延迟 100ms，以确保 TagInput 等失焦事件触发的 React 状态能完全更新到了 tagsRef
    setTimeout(async () => {
      try {
        await autoSave(content)
        // 等待列表页处理 diary:sync-event，再播放退出动画并返回
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
        playSaveExitAndGoBack()
      } catch (e: any) {
        toast.showError(
          e?.message || t('diary.save_failed', '保存失败，可能由于日期重复或系统错误')
        )
      } finally {
        setIsSaving(false)
      }
    }, 100)
  }

  if (isLoading) {
    return (
      <div
        style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}
      >
        Loading...
      </div>
    )
  }

  return (
    <motion.div
      className="diary-editor-page-container"
      initial={{ opacity: 0, y: 30 }}
      animate={
        isLeavingAfterSave
          ? { opacity: 0, y: 28, scale: 0.97 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={
        isLeavingAfterSave
          ? DIARY_EDITOR_SAVE_EXIT_TRANSITION
          : { type: 'spring', damping: 25, stiffness: 200 }
      }
      onAnimationComplete={handleSaveExitComplete}
    >
      <DiaryEditor
        content={content}
        tags={tags}
        selectedDate={selectedDate}
        weather={weather}
        isFavorite={isFavorite}
        mediaPaths={mediaPaths}
        onContentChange={handleContentChange}
        onTagsChange={(newTags) => {
          setTags(newTags)
          setIsDirty(true)
        }}
        onDateChange={(newDate) => {
          setSelectedDate(newDate)
          setIsDirty(true)
        }}
        onWeatherChange={(v) => {
          setWeather(v)
          setIsDirty(true)
        }}
        onFavoriteChange={(v) => {
          setIsFavorite(v)
          setIsDirty(true)
        }}
        onMediaPathsChange={(v) => {
          setMediaPaths(v)
          setIsDirty(true)
        }}
        onSave={handleSave}
        onCancel={handleBack}
      />

      {/* Delete/Exit Confirmation Modal (Reusing DB Delete Modal Styling) */}
      {showExitConfirm && (
        <div className="diary-delete-modal-overlay" onClick={() => setShowExitConfirm(false)}>
          <div className="diary-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dd-modal-title">{t('common.confirm_leave', '确认离开')}</div>
            <div
              className="dd-modal-content"
              style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}
            >
              {t(
                'diary.editor_leave_confirm',
                '当前有尚未保存的文字，如果强行退出，将不会保存刚才键入的内容。确定要丢弃并离开吗？'
              )}
            </div>
            <div className="dd-modal-actions" style={{ marginTop: '24px' }}>
              <button className="dd-btn-cancel" onClick={() => setShowExitConfirm(false)}>
                {t('common.cancel', '我再写写')}
              </button>
              <button
                className="dd-btn-confirm"
                onClick={() => goBackToSidebar()}
                style={{ background: '#ef4444', color: 'white' }}
              >
                {t('common.leave', '强行离开')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
