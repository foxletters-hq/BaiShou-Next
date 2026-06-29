import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useTranslation } from 'react-i18next'
import { useIsFocused } from '@react-navigation/native'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import {
  DiaryEditor,
  isLikelyEditorBundleLeak,
  useNativeTheme,
  useDialog,
  useNativeToast
} from '@baishou/ui/native'
import { mergeDiaryTags } from '@baishou/ai'
import {
  joinDiaryContentWithAppendBlock,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  composeDiaryEditorContent,
  parseDiaryEditorContent,
  normalizeDiaryTagColorRegistry,
  pickEntryTagColors,
  syncDiaryTagColorRegistry,
  type DiaryTagColorRegistry,
  type DiaryTemplateConfig
} from '@baishou/shared'
import { useBaishou } from '../../providers/BaishouProvider'
import {
  getDiaryInsertMarkdown,
  pickDiaryImagesFromLibrary,
  uploadDiaryAttachments
} from '../../services/mobile-diary-attachment.service'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { useAttachmentImageLoader } from '../../hooks/useAttachmentImageLoader'
import { useDiaryEditorWebViewSource } from '../../hooks/useDiaryEditorWebViewSource'
import { resolveDiaryAttachmentUrlForWebView } from '../../services/diary-cm-attachment-url.service'
import { extractDiaryAttachmentRefs } from '../../utils/diary-attachment-prefetch.util'
import { clearDiaryAttachmentAbsPathCache } from '../../utils/mobile-diary-attachment-resolver'
import { FullFileAccessGate } from '../../components/FullFileAccessGate'
import {
  assertExternalStorageReady,
  isExternalStorageRequiredError
} from '../../services/storage-permission.service'

export const DiaryEditorScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const dialog = useDialog()
  const toast = useNativeToast()
  const { id, date, append } = useLocalSearchParams<{
    id?: string
    date?: string
    append?: string
  }>()
  const router = useRouter()
  const navigation = useNavigation()
  const { services, dbReady } = useBaishou()
  const { granted: storageGranted, request: requestStorage } = useStoragePermission()

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weather, setWeather] = useState<string | null>(null)
  const [mood, setMood] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [existingId, setExistingId] = useState<number | null>(null)
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const isDirtyRef = useRef(false)
  const originalTagsRef = useRef<string[]>([])
  const [pickingImages, setPickingImages] = useState(false)
  const editorWebViewSource = useDiaryEditorWebViewSource()
  const isFocused = useIsFocused()
  const [tagColorRegistry, setTagColorRegistry] = useState<DiaryTagColorRegistry>({})
  const previousTagsRef = useRef<string[]>([])

  const isAppendMode = append === '1'

  const parseDiaryTags = (raw: string | string[] | null | undefined): string[] => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }

  const applyLoadedDiary = (
    diary: {
      id?: number | null
      content: string
      tags?: string | string[] | null
      tagColors?: string | Record<string, number> | null
      date: Date
      weather?: string | null
      mood?: string | null
      isFavorite?: boolean
    },
    templateConfig: DiaryTemplateConfig,
    now: Date
  ) => {
    const parsedTags = parseDiaryTags(diary.tags)
    const entryTagColors = normalizeDiaryTagColorRegistry(diary.tagColors)
    setTagColorRegistry(entryTagColors)
    previousTagsRef.current = parsedTags
    originalTagsRef.current = parsedTags
    setExistingId(diary.id ?? null)
    setSelectedDate(diary.date)
    setWeather(diary.weather || null)
    setMood(diary.mood || null)
    setIsFavorite(diary.isFavorite || false)

    if (isAppendMode) {
      const safeExisting = isLikelyEditorBundleLeak(diary.content || '') ? '' : diary.content || ''
      const timeMark = resolveDiaryAppendBlock(templateConfig, now)
      setContent(joinDiaryContentWithAppendBlock(safeExisting, timeMark))
      setOriginalContent(safeExisting.trimEnd())
      setTags([])
      previousTagsRef.current = []
      setTagColorRegistry({})
    } else {
      const safeContent = isLikelyEditorBundleLeak(diary.content) ? '' : diary.content
      if (safeContent !== diary.content) {
        toast.showError(
          t('diary.content_corrupted_hint', '日记正文异常，已阻止加载损坏内容，请从备份恢复')
        )
      }
      setContent(composeDiaryEditorContent(safeContent, parsedTags))
      setOriginalContent(safeContent)
      setTags(parsedTags)
    }
  }

  useEffect(() => {
    if (!dbReady || !services) return

    let cancelled = false
    setLoading(true)

    const fetchDiary = async () => {
      try {
        const templateConfig =
          (await services.settingsManager.get<DiaryTemplateConfig>('diary_template_config')) || {}
        const now = new Date()

        if (id) {
          const diary = await services.diaryService.findById(Number(id))
          if (diary) {
            applyLoadedDiary(diary, templateConfig, now)
          }
        } else if (date) {
          const existing = await services.diaryService.findByDate(new Date(date))
          if (existing) {
            applyLoadedDiary(existing, templateConfig, now)
          } else {
            originalTagsRef.current = []
            setTagColorRegistry({})
            setContent(resolveDiaryNewEntryContent(templateConfig, now))
            setSelectedDate(new Date(date))
          }
        } else {
          originalTagsRef.current = []
          setTagColorRegistry({})
          setContent(resolveDiaryNewEntryContent(templateConfig, now))
        }
      } catch (e) {
        console.error('Failed to load diary:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchDiary()
    return () => {
      cancelled = true
    }
  }, [id, date, append, dbReady, services, isAppendMode])

  const handleSave = async () => {
    if (!services) return

    if (isLikelyEditorBundleLeak(content)) {
      toast.showError(t('diary.content_corrupted_hint', '日记正文异常，已阻止保存损坏内容'))
      return
    }

    try {
      await assertExternalStorageReady()
      const { tags: parsedTags, body } = parseDiaryEditorContent(content)
      const mergedTags = isAppendMode
        ? mergeDiaryTags(originalTagsRef.current.join(', '), parsedTags.join(','))
        : parsedTags.join(',')
      const entryTagColors = pickEntryTagColors(parsedTags, tagColorRegistry)
      const input = {
        content: body,
        tags: mergedTags,
        tagColors: Object.keys(entryTagColors).length > 0 ? entryTagColors : undefined,
        date: selectedDate,
        weather: weather || undefined,
        mood: mood || undefined,
        isFavorite
      }

      await services.diaryService.save(existingId, input)
      setIsDirty(false)
      isDirtyRef.current = false
      router.back()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (
        isExternalStorageRequiredError(e) ||
        msg.includes('expo-file-system') ||
        msg.includes('原生存储')
      ) {
        const openSettings = await dialog.confirm(
          msg.includes('pnpm dev:mobile:clear') ? msg : t('storage.all_files_access_settings_hint'),
          { confirmText: t('settings.check_storage_permission') }
        )
        if (openSettings) void requestStorage()
        return
      }
      if (msg.includes('BaiShou_Root') && msg.includes('externalMakeDirectory')) {
        toast.showError(msg)
        return
      }
      console.error('Failed to save diary:', e)
      toast.showError(msg || t('diary.save_failed'))
    }
  }

  const handleContentChange = (text: string) => {
    const { tags: parsedTags } = parseDiaryEditorContent(text)
    setTagColorRegistry((prev) => {
      const next = syncDiaryTagColorRegistry(parsedTags, previousTagsRef.current, prev)
      previousTagsRef.current = parsedTags
      return next
    })
    setContent(text)
    setTags(parsedTags)
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags)
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleMoodChange = (newMood: string) => {
    setMood(newMood || null)
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleWeatherChange = (newWeather: string | null) => {
    setWeather(newWeather)
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleFavoriteChange = (newIsFavorite: boolean) => {
    setIsFavorite(newIsFavorite)
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const attachmentCacheRef = useRef<Record<string, string>>({})
  const { loadImageUri } = useAttachmentImageLoader(services?.fileSystem)

  useEffect(() => {
    attachmentCacheRef.current = {}
    clearDiaryAttachmentAbsPathCache()
  }, [selectedDate])

  const resolveAttachmentUrl = useCallback(
    async (src: string): Promise<string | null> => {
      if (!src.startsWith('attachment/')) return src
      const cached = attachmentCacheRef.current[src]
      if (cached) return cached
      if (!services?.pathService || !services?.fileSystem) return null
      const url = await resolveDiaryAttachmentUrlForWebView(
        services.pathService,
        services.fileSystem,
        selectedDate,
        src,
        (absPath) => loadImageUri(absPath, 'editor')
      )
      if (url) {
        attachmentCacheRef.current = { ...attachmentCacheRef.current, [src]: url }
      }
      return url
    },
    [loadImageUri, selectedDate, services?.pathService, services?.fileSystem]
  )

  useEffect(() => {
    if (!content || !services?.pathService || !services?.fileSystem) return
    const refs = extractDiaryAttachmentRefs(content)
    if (!refs.length) return

    let cancelled = false
    void Promise.all(
      refs.map(async (src) => {
        if (cancelled) return
        await resolveAttachmentUrl(src)
      })
    )
    return () => {
      cancelled = true
    }
  }, [content, resolveAttachmentUrl, services?.fileSystem, services?.pathService])

  const handlePickImages = useCallback(async (): Promise<string[]> => {
    if (!services?.pathService) return []
    setPickingImages(true)
    try {
      const assets = await pickDiaryImagesFromLibrary()
      if (!assets?.length) return []

      const results = await uploadDiaryAttachments(
        services.pathService,
        services.fileSystem,
        selectedDate,
        assets
      )
      const markdowns = results
        .filter((r) => r.success && r.fileName)
        .map((r) => getDiaryInsertMarkdown(r.fileName!))

      if (markdowns.length) setIsDirty(true)
      return markdowns
    } catch (e) {
      console.error('Failed to upload diary images:', e)
      return []
    } finally {
      setPickingImages(false)
    }
  }, [services?.pathService, selectedDate])

  const handleBack = async () => {
    if (isDirty) {
      const confirmed = await dialog.confirm(t('diary.exit_confirmation_hint'), {
        confirmText: t('diary.exit_without_saving_confirm'),
        destructive: true
      })
      if (confirmed) {
        setIsDirty(false)
        isDirtyRef.current = false
        router.back()
      }
    } else {
      router.back()
    }
  }

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!isDirtyRef.current) return

      e.preventDefault()
      void (async () => {
        const confirmed = await dialog.confirm(t('diary.exit_confirmation_hint'), {
          confirmText: t('diary.exit_without_saving_confirm'),
          destructive: true
        })
        if (confirmed) {
          setIsDirty(false)
          isDirtyRef.current = false
          router.back()
        }
      })()
    })
    return unsub
  }, [navigation, dialog, t, router])

  if (loading) {
    return (
      <ScreenSafeArea preset="screen" style={{ backgroundColor: colors.bgApp }}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.accentGreen} />
        </View>
      </ScreenSafeArea>
    )
  }

  return (
    <ScreenSafeArea preset="screen" style={{ backgroundColor: colors.bgSurface }}>
      <FullFileAccessGate granted={storageGranted} onRequest={() => void requestStorage()}>
        <DiaryEditor
          content={content}
          tags={tags}
          selectedDate={selectedDate}
          weather={weather || ''}
          mood={mood || ''}
          isFavorite={isFavorite}
          editorWebViewSource={editorWebViewSource}
          webViewActive={isFocused}
          onContentChange={handleContentChange}
          onTagsChange={handleTagsChange}
          tagColorRegistry={tagColorRegistry}
          onDateChange={setSelectedDate}
          onWeatherChange={handleWeatherChange}
          onMoodChange={handleMoodChange}
          onFavoriteChange={handleFavoriteChange}
          onPickImages={handlePickImages}
          pickingImages={pickingImages}
          resolveAttachmentUrl={resolveAttachmentUrl}
          onSave={handleSave}
          onCancel={handleBack}
        />
      </FullFileAccessGate>
    </ScreenSafeArea>
  )
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' }
})
