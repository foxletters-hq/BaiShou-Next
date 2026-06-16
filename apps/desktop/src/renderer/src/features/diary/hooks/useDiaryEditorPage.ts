import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  formatLocalDate,
  normalizeWeatherId,
  safeParseDate,
  logger,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  type DiaryTemplateConfig
} from '@baishou/shared'
import { useToast } from '@baishou/ui'

type DiaryEditorInitialState = {
  content: string
  tags: string[]
  selectedDate: Date
  weather: string
  isFavorite: boolean
  mediaPaths: string[]
}

export function useDiaryEditorPage() {
  const { t } = useTranslation()
  const { dateStr } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const isAppendMode = searchParams.get('append') === '1'

  const parseInitialDate = useCallback((): Date => {
    if (!dateStr || dateStr === 'new') {
      const dParam = searchParams.get('date')
      return safeParseDate(dParam ?? undefined)
    }
    return safeParseDate(dateStr)
  }, [dateStr, searchParams])

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
  const initialStateRef = useRef<DiaryEditorInitialState | null>(null)

  const loadTemplateConfig = useCallback(async (): Promise<DiaryTemplateConfig> => {
    try {
      const api = (window as any).api?.settings
      if (api?.getDiaryTemplateConfig) {
        return (await api.getDiaryTemplateConfig()) || {}
      }
    } catch (e) {
      logger.warn('Failed to load diary template config', { error: e })
    }
    return {}
  }, [])

  useEffect(() => {
    let cancelled = false

    const initEditor = async () => {
      const templateConfig = await loadTemplateConfig()
      if (cancelled) return
      const now = new Date()

      if (!dateStr || dateStr === 'new') {
        const initialContent = resolveDiaryNewEntryContent(templateConfig, now)
        setContent(initialContent)
        initialStateRef.current = {
          content: initialContent,
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
        try {
          const diary = await (window as any).api.diary.findByDate(dateStr)
          if (cancelled) return

          let initialContent = ''
          let initialTags: string[] = []
          let initialWeather = ''
          let initialFavorite = false
          let initialMedia: string[] = []

          if (diary) {
            setDiaryId(diary.id || null)
            const parsedTags =
              typeof diary.tags === 'string'
                ? diary.tags.split(',').filter(Boolean)
                : diary.tags || []
            const parsedWeather = normalizeWeatherId(diary.weather || '') || ''
            setTags(parsedTags)
            setWeather(parsedWeather)
            setIsFavorite(diary.isFavorite || false)
            setMediaPaths(diary.mediaPaths || [])

            initialTags = parsedTags
            initialWeather = parsedWeather
            initialFavorite = diary.isFavorite || false
            initialMedia = diary.mediaPaths || []

            if (isAppendMode) {
              const existing = (diary.content || '').trimEnd()
              const timeMark = resolveDiaryAppendBlock(templateConfig, now)
              initialContent = existing ? existing + timeMark : timeMark.trimStart()
            } else {
              initialContent = diary.content || ''
            }
          } else {
            initialContent = resolveDiaryNewEntryContent(templateConfig, now)
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
        } catch (e: unknown) {
          logger.error('Failed to load diary', { error: e, dateStr })
          const fallback = resolveDiaryNewEntryContent(templateConfig, now)
          setContent(fallback)
          initialStateRef.current = {
            content: fallback,
            tags: [],
            selectedDate: parseInitialDate(),
            weather: '',
            isFavorite: false,
            mediaPaths: []
          }
        } finally {
          if (!cancelled) setIsLoading(false)
        }
      } else if (!cancelled) {
        setIsLoading(false)
      }
    }

    void initEditor()

    return () => {
      cancelled = true
    }
  }, [dateStr, isAppendMode, parseInitialDate, loadTemplateConfig])

  const autoSave = useCallback(
    async (newContent: string) => {
      if (!newContent.trim() && !diaryId) return
      try {
        if (typeof window !== 'undefined' && (window as any).api?.diary) {
          const selectedDateStr = formatLocalDate(selectedDate)

          const payload = {
            date: selectedDateStr,
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

          const saved = await (window as any).api.diary.save(diaryId, payload)
          if (saved?.id && saved.id !== diaryId) {
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
      } catch (e: unknown) {
        logger.error('Diary save failed', { error: e })
        throw e
      }
    },
    [selectedDate, weather, isFavorite, diaryId, mediaPaths]
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

  const goBackToSidebar = useCallback(() => {
    const lastNav = sessionStorage.getItem('desktop_last_nav')
    if (lastNav && lastNav !== '/diary') {
      navigate(lastNav)
    } else {
      navigate('/diary')
    }
  }, [navigate])

  const handleBack = () => {
    if (checkIsReallyDirty()) {
      setShowExitConfirm(true)
    } else {
      goBackToSidebar()
    }
  }

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await autoSave(content)
      await new Promise((resolve) => setTimeout(resolve, 180))
      goBackToSidebar()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : undefined
      toast.showError(message || t('diary.save_failed', '保存失败，可能由于日期重复或系统错误'))
      setIsSaving(false)
    }
  }

  return {
    t,
    isLoading,
    content,
    tags,
    selectedDate,
    weather,
    isFavorite,
    mediaPaths,
    isDirty,
    isSaving,
    showExitConfirm,
    setShowExitConfirm,
    handleContentChange,
    handleBack,
    handleSave,
    goBackToSidebar,
    setTags,
    setSelectedDate,
    setWeather,
    setIsFavorite,
    setMediaPaths,
    setIsDirty
  }
}
