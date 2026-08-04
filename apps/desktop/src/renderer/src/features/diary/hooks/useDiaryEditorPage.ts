import { useState, useEffect, useRef, useCallback, createElement } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  formatLocalDate,
  normalizeWeatherId,
  normalizeMoodId,
  normalizeDiaryTags,
  safeParseDate,
  logger,
  joinDiaryContentWithAppendBlock,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  composeDiaryEditorContent,
  parseDiaryEditorContent,
  mergeDiaryTags,
  type DiaryTemplateConfig
} from '@baishou/shared'
import { useToast, useDialog } from '@baishou/ui'
import { ensureDesktopGraphSelfName } from '../utils/ensure-graph-self-name'

type DiaryEditorInitialState = {
  content: string
  selectedDate: Date
  weather: string
  mood: string
  isFavorite: boolean
  mediaPaths: string[]
}

function normalizeDiaryContentForCompare(text: string): string {
  return text.replace(/\r\n/g, '\n')
}

export function useDiaryEditorPage() {
  const { t } = useTranslation()
  const { dateStr } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const dialog = useDialog()

  const isAppendMode = searchParams.get('append') === '1'

  const parseInitialDate = useCallback((): Date => {
    if (!dateStr || dateStr === 'new') {
      const dParam = searchParams.get('date')
      return safeParseDate(dParam ?? undefined)
    }
    return safeParseDate(dateStr)
  }, [dateStr, searchParams])

  const [content, setContent] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date>(() => parseInitialDate())
  const [weather, setWeather] = useState('')
  const [mood, setMood] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [diaryId, setDiaryId] = useState<number | null>(null)
  const [mediaPaths, setMediaPaths] = useState<string[]>([])
  const originalTagsRef = useRef<string[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [attachmentBasePath, setAttachmentBasePath] = useState('')
  const initialStateRef = useRef<DiaryEditorInitialState | null>(null)
  const stateSnapshotRef = useRef<DiaryEditorInitialState>({
    content: '',
    selectedDate: parseInitialDate(),
    weather: '',
    mood: '',
    isFavorite: false,
    mediaPaths: []
  })

  useEffect(() => {
    stateSnapshotRef.current = {
      content,
      selectedDate,
      weather,
      mood,
      isFavorite,
      mediaPaths
    }
  }, [content, selectedDate, weather, mood, isFavorite, mediaPaths])

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

  const fetchAttachmentDir = useCallback(async (date: Date): Promise<string> => {
    try {
      const api = (window as any).api?.diary
      if (!api?.getAttachmentDir) return ''
      const result = await api.getAttachmentDir(formatLocalDate(date))
      return result?.success && result.path ? result.path : ''
    } catch (e) {
      logger.warn('Failed to load diary attachment dir', { error: e })
      return ''
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const initEditor = async () => {
      setIsLoading(true)
      const initialDate = parseInitialDate()
      const api = typeof window !== 'undefined' ? (window as any).api?.diary : undefined

      if (!dateStr || dateStr === 'new') {
        const [templateConfig, attPath] = await Promise.all([
          loadTemplateConfig(),
          fetchAttachmentDir(initialDate)
        ])
        if (cancelled) return
        setAttachmentBasePath(attPath)
        const now = new Date()
        const initialContent = resolveDiaryNewEntryContent(templateConfig, now)
        setContent(initialContent)
        initialStateRef.current = {
          content: initialContent,
          selectedDate: initialDate,
          weather: '',
          mood: '',
          isFavorite: false,
          mediaPaths: []
        }
        setIsLoading(false)
        return
      }

      if (api) {
        try {
          const [templateConfig, diary, attPath] = await Promise.all([
            loadTemplateConfig(),
            api.findByDate(dateStr),
            fetchAttachmentDir(initialDate)
          ])
          if (cancelled) return
          setAttachmentBasePath(attPath)

          const now = new Date()
          let initialContent = ''
          let initialWeather = ''
          let initialMood = ''
          let initialFavorite = false
          let initialMedia: string[] = []

          if (diary) {
            setDiaryId(diary.id || null)
            const parsedTags = normalizeDiaryTags(diary.tags)
            const parsedWeather = normalizeWeatherId(diary.weather || '') || ''
            const parsedMood = normalizeMoodId(diary.mood || '') || ''
            setWeather(parsedWeather)
            setMood(parsedMood)
            setIsFavorite(diary.isFavorite || false)
            setMediaPaths(diary.mediaPaths || [])

            originalTagsRef.current = parsedTags
            initialWeather = parsedWeather
            initialMood = parsedMood
            initialFavorite = diary.isFavorite || false
            initialMedia = diary.mediaPaths || []

            if (isAppendMode) {
              const timeMark = resolveDiaryAppendBlock(templateConfig, now)
              initialContent = joinDiaryContentWithAppendBlock(diary.content || '', timeMark)
            } else {
              initialContent = composeDiaryEditorContent(diary.content || '', parsedTags)
            }
          } else {
            initialContent = resolveDiaryNewEntryContent(templateConfig, now)
            originalTagsRef.current = []
          }

          setContent(initialContent)
          initialStateRef.current = {
            content: initialContent,
            selectedDate: initialDate,
            weather: initialWeather,
            mood: initialMood,
            isFavorite: initialFavorite,
            mediaPaths: initialMedia
          }
        } catch (e: unknown) {
          logger.error('Failed to load diary', { error: e, dateStr })
          const fallbackConfig = await loadTemplateConfig()
          const fallback = resolveDiaryNewEntryContent(fallbackConfig, new Date())
          setContent(fallback)
          initialStateRef.current = {
            content: fallback,
            selectedDate: initialDate,
            weather: '',
            mood: '',
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
  }, [dateStr, isAppendMode, parseInitialDate, loadTemplateConfig, fetchAttachmentDir])

  // 编辑器挂载并完成首轮同步后，以实际展示状态作为「未修改」基线
  useEffect(() => {
    if (isLoading) return

    let cancelled = false
    let rafId = 0

    const commitBaseline = () => {
      if (cancelled) return
      const snap = stateSnapshotRef.current
      initialStateRef.current = {
        content: snap.content,
        selectedDate: snap.selectedDate,
        weather: snap.weather,
        mood: snap.mood,
        isFavorite: snap.isFavorite,
        mediaPaths: [...snap.mediaPaths]
      }
      setIsDirty(false)
    }

    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(commitBaseline)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [isLoading, dateStr, isAppendMode])

  const autoSave = useCallback(
    async (newContent: string) => {
      if (!newContent.trim() && !diaryId) return
      try {
        if (typeof window !== 'undefined' && (window as any).api?.diary) {
          const selectedDateStr = formatLocalDate(selectedDate)
          const { tags: parsedTags, body } = parseDiaryEditorContent(newContent)
          const mergedTags = isAppendMode
            ? mergeDiaryTags(originalTagsRef.current.join(', '), parsedTags.join(','))
            : parsedTags.join(',')

          const payload = {
            date: selectedDateStr,
            content: body,
            title: body
              .replace(/^#{1,6}\s*/gm, '')
              .split('\n')[0]
              .substring(0, 50),
            tags: mergedTags,
            weather,
            mood,
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
          selectedDate,
          weather,
          mood,
          isFavorite,
          mediaPaths
        }
      } catch (e: unknown) {
        logger.error('Diary save failed', { error: e })
        throw e
      }
    },
    [selectedDate, weather, mood, isFavorite, diaryId, mediaPaths, isAppendMode]
  )

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    const baseline = initialStateRef.current
    if (
      baseline &&
      normalizeDiaryContentForCompare(newContent) !==
        normalizeDiaryContentForCompare(baseline.content)
    ) {
      setIsDirty(true)
    }
  }

  const checkIsReallyDirty = (): boolean => {
    if (!initialStateRef.current) return false
    const init = initialStateRef.current

    if (
      normalizeDiaryContentForCompare(content) !== normalizeDiaryContentForCompare(init.content)
    ) {
      return true
    }
    if (weather !== init.weather) return true
    if (mood !== init.mood) return true
    if (isFavorite !== init.isFavorite) return true
    if (formatLocalDate(selectedDate) !== formatLocalDate(init.selectedDate)) return true

    const currentMediaSorted = [...mediaPaths].sort().join(',')
    const initMediaSorted = [...init.mediaPaths].sort().join(',')
    if (currentMediaSorted !== initMediaSorted) return true

    return false
  }

  const [showExitConfirm, setShowExitConfirm] = useState(false)
  /** idle → saving → leaving（退场动画）→ 导航 */
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'leaving'>('idle')

  const goBackToSidebar = useCallback(() => {
    const lastNav = sessionStorage.getItem('desktop_last_nav')
    if (lastNav && lastNav !== '/diary') {
      navigate(lastNav)
    } else {
      navigate('/diary')
    }
  }, [navigate])

  const handleBack = () => {
    if (savePhase !== 'idle') return
    if (checkIsReallyDirty()) {
      setShowExitConfirm(true)
    } else {
      goBackToSidebar()
    }
  }

  const handleSave = async () => {
    if (savePhase !== 'idle') return
    setSavePhase('saving')
    try {
      await autoSave(content)
      const dateKey = formatLocalDate(selectedDate)
      let pendingFilePath: string | null = null
      try {
        const pending = await window.api.graph.listPendingReextract()
        const hit = pending.find(
          (p) => p.date === dateKey || String(p.filePath || '').includes(dateKey)
        )
        pendingFilePath = hit?.filePath ?? null
      } catch {
        // graph API optional for save success path
      }

      if (pendingFilePath) {
        const extractPath = pendingFilePath
        toast.showSuccess(
          createElement(
            'span',
            { style: { display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
            t('common.saved', '已保存'),
            ' · ',
            createElement(
              'button',
              {
                type: 'button',
                style: {
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  margin: 0,
                  color: 'var(--accent, #2563eb)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  font: 'inherit'
                },
                onClick: (e: { stopPropagation: () => void }) => {
                  e.stopPropagation()
                  void (async () => {
                    try {
                      const selfName = await ensureDesktopGraphSelfName({
                        prompt: dialog.prompt,
                        t
                      })
                      if (!selfName) {
                        toast.showError(
                          t('graph.self_name_required', '请先设置图谱自称后再抽取')
                        )
                        return
                      }
                      toast.showInfo(t('graph.extracting', '正在抽取…'), { duration: 0 })
                      const result = await window.api.graph.extract({ filePaths: [extractPath] })
                      if (result.failed > 0) {
                        toast.showError(
                          t('graph.extract_failed', '整理失败（{{failed}}）', {
                            failed: result.failed
                          })
                        )
                      } else {
                        toast.showSuccess(t('graph.extract_this_done', '已记住这篇里的人和事'))
                      }
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : String(err)
                      toast.showError(message || t('graph.extract_failed', '整理失败'))
                    }
                  })()
                }
              },
              t('graph.extract_this_entry', '让伙伴记住这篇里的人和事')
            )
          ),
          { duration: 8000 }
        )
      } else {
        toast.showSuccess(t('common.saved', '已保存'))
      }
      setSavePhase('leaving')
      await new Promise((resolve) => setTimeout(resolve, 320))
      goBackToSidebar()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : undefined
      toast.showError(message || t('diary.save_failed', '保存失败，可能由于日期重复或系统错误'))
      setSavePhase('idle')
    }
  }

  return {
    t,
    isLoading,
    attachmentBasePath,
    content,
    selectedDate,
    weather,
    mood,
    isFavorite,
    mediaPaths,
    isDirty,
    isSaving: savePhase !== 'idle',
    savePhase,
    showExitConfirm,
    setShowExitConfirm,
    handleContentChange,
    handleBack,
    handleSave,
    goBackToSidebar,
    setSelectedDate,
    setWeather,
    setMood,
    setIsFavorite,
    setMediaPaths,
    setIsDirty
  }
}
