import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, StyleSheet, ActivityIndicator, Keyboard } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import {
  DiaryEditor,
  isLikelyEditorBundleLeak,
  useNativeTheme,
  useDialog,
  useNativeToast
} from '@baishou/ui/native'
import { mergeDiaryTags } from '@baishou/ai'
import {
  buildDiaryListSavedPatch,
  parseDiaryEditorContent,
  pickEntryTagColors,
  syncDiaryTagColorRegistry,
  formatLocalDate,
  parseDateStr,
  type DiaryTagColorRegistry,
  type DiaryTemplateConfig
} from '@baishou/shared'
import { notifyDiaryListAfterSave } from '@baishou/shared/cache'
import { useBaishou } from '../../providers/BaishouProvider'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { useAttachmentImageLoader } from '../../hooks/useAttachmentImageLoader'
import { useDiaryEditorWebViewSource } from '../../hooks/useDiaryEditorWebViewSource'
import { useMarkdownToolbarOrder } from '../../hooks/useMarkdownToolbarOrder'
import { useTTS } from '../../hooks/useTTS'
import { FullFileAccessGate } from '../../components/FullFileAccessGate'
import {
  assertExternalStorageReady,
  isExternalStorageRequiredError
} from '../../services/storage-permission.service'
import { createDiaryEditorLifecycleHandlers } from './diary-editor-lifecycle.helpers'
import { useDiaryEditorAttachments, useDiaryEditorExitGuard } from './useDiaryEditorAttachments'

const DIARY_TTS_PLAYBACK_ID = 'diary-editor'

export const DiaryEditorScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const dialog = useDialog()
  const toast = useNativeToast()
  const {
    id,
    date,
    append,
    new: newParam
  } = useLocalSearchParams<{
    id?: string
    date?: string
    append?: string
    new?: string
  }>()
  const router = useRouter()
  const navigation = useNavigation()
  const { services, dbReady } = useBaishou()
  const { granted: storageGranted, request: requestStorage } = useStoragePermission()
  const { toolOrder, saveToolOrder } = useMarkdownToolbarOrder()
  const { ttsPlayingMsgId, handleTtsReadAloud } = useTTS()

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(() => parseDateStr(formatLocalDate(new Date())))
  const selectedDateRef = useRef(selectedDate)
  const loadedDateKeyRef = useRef<string | null>(null)
  const existingIdRef = useRef<number | null>(null)
  const [weather, setWeather] = useState<string | null>(null)
  const [mood, setMood] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [existingId, setExistingId] = useState<number | null>(null)
  const [, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const isDirtyRef = useRef(false)
  const metadataDirtyRef = useRef(false)
  const savedEditorSnapshotRef = useRef<{ body: string; tags: string }>({ body: '', tags: '' })
  const originalTagsRef = useRef<string[]>([])
  const editorWebViewSource = useDiaryEditorWebViewSource()
  const [tagColorRegistry, setTagColorRegistry] = useState<DiaryTagColorRegistry>({})
  const previousTagsRef = useRef<string[]>([])

  const dismissEditorKeyboard = useCallback(() => {
    Keyboard.dismiss()
  }, [])

  useFocusEffect(
    useCallback(() => {
      return () => {
        dismissEditorKeyboard()
      }
    }, [dismissEditorKeyboard])
  )

  const handleReadAloud = useCallback(() => {
    void handleTtsReadAloud(content, DIARY_TTS_PLAYBACK_ID)
  }, [content, handleTtsReadAloud])

  const isAppendMode = append === '1'
  const isNewEntryMode = newParam === '1'
  const isNewEntryModeRef = useRef(isNewEntryMode)

  useEffect(() => {
    isNewEntryModeRef.current = isNewEntryMode
  }, [isNewEntryMode])

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  useEffect(() => {
    existingIdRef.current = existingId
  }, [existingId])

  const normalizeDiaryCalendarDate = useCallback((date: Date) => {
    return parseDateStr(formatLocalDate(date))
  }, [])

  const handleDateChange = useCallback(
    (date: Date) => {
      const normalized = normalizeDiaryCalendarDate(date)
      const prevKey = formatLocalDate(selectedDateRef.current)
      const nextKey = formatLocalDate(normalized)
      if (prevKey === nextKey) return

      selectedDateRef.current = normalized
      setSelectedDate(normalized)
      metadataDirtyRef.current = true
      setIsDirty(true)
      isDirtyRef.current = true

      if (
        loadedDateKeyRef.current &&
        loadedDateKeyRef.current !== nextKey &&
        existingIdRef.current !== null
      ) {
        existingIdRef.current = null
        setExistingId(null)
      }
    },
    [normalizeDiaryCalendarDate]
  )

  const { initBlankDiaryEntry, applyLoadedDiary } = createDiaryEditorLifecycleHandlers({
    isAppendMode,
    normalizeDiaryCalendarDate,
    state: {
      setContent,
      setTags,
      setSelectedDate,
      setExistingId,
      setWeather,
      setMood,
      setIsFavorite,
      setTagColorRegistry,
      setOriginalContent,
      setIsDirty
    },
    refs: {
      selectedDateRef,
      loadedDateKeyRef,
      existingIdRef,
      isDirtyRef,
      metadataDirtyRef,
      savedEditorSnapshotRef,
      originalTagsRef,
      previousTagsRef
    },
    t,
    toast
  })

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
        } else if (isNewEntryMode) {
          const targetDate = date
            ? normalizeDiaryCalendarDate(new Date(date))
            : normalizeDiaryCalendarDate(now)
          initBlankDiaryEntry(templateConfig, now, targetDate)
        } else if (date) {
          const existing = await services.diaryService.findByDate(new Date(date))
          if (existing) {
            applyLoadedDiary(existing, templateConfig, now)
          } else {
            initBlankDiaryEntry(templateConfig, now, normalizeDiaryCalendarDate(new Date(date)))
          }
        } else {
          initBlankDiaryEntry(templateConfig, now, normalizeDiaryCalendarDate(now))
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
  }, [
    id,
    date,
    append,
    newParam,
    dbReady,
    services,
    isAppendMode,
    isNewEntryMode,
    normalizeDiaryCalendarDate
    // initBlankDiaryEntry / applyLoadedDiary 使用稳定 setState + ref，勿放入 deps
  ])

  const handleSave = async () => {
    if (!services) return

    if (isLikelyEditorBundleLeak(content)) {
      toast.showError(t('diary.content_corrupted_hint', '日记正文异常，已阻止保存损坏内容'))
      return
    }

    try {
      await assertExternalStorageReady()
      const targetDate = normalizeDiaryCalendarDate(selectedDateRef.current)
      const { tags: parsedTags, body } = parseDiaryEditorContent(content)
      const mergedTags = isAppendMode
        ? mergeDiaryTags(originalTagsRef.current.join(', '), parsedTags.join(','))
        : parsedTags.join(',')
      const entryTagColors = pickEntryTagColors(parsedTags, tagColorRegistry)
      const saveId =
        !isNewEntryModeRef.current &&
        existingIdRef.current !== null &&
        loadedDateKeyRef.current === formatLocalDate(targetDate)
          ? existingIdRef.current
          : null
      const input = {
        content: body,
        tags: mergedTags,
        tagColors: Object.keys(entryTagColors).length > 0 ? entryTagColors : undefined,
        date: targetDate,
        weather: weather || undefined,
        mood: mood || undefined,
        isFavorite
      }

      const saved = await services.diaryService.save(saveId, input)
      const patch = buildDiaryListSavedPatch(saved)
      if (patch) notifyDiaryListAfterSave(patch)
      savedEditorSnapshotRef.current = {
        body: parseDiaryEditorContent(content).body,
        tags: parsedTags.join(',')
      }
      metadataDirtyRef.current = false
      setIsDirty(false)
      isDirtyRef.current = false
      dismissEditorKeyboard()
      router.back()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (
        isExternalStorageRequiredError(e) ||
        msg.includes('expo-file-system') ||
        msg.includes(
          t('auto.apps.mobile.src.screens.DiaryScreen.DiaryEditorScreen.L360', '原生存储')
        )
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
    const { tags: parsedTags, body } = parseDiaryEditorContent(text)
    setTagColorRegistry((prev) => {
      const next = syncDiaryTagColorRegistry(parsedTags, previousTagsRef.current, prev)
      previousTagsRef.current = parsedTags
      return next
    })
    setContent(text)
    setTags(parsedTags)
    const saved = savedEditorSnapshotRef.current
    const contentUnchanged = saved.body === body && saved.tags === parsedTags.join(',')
    const dirty = !contentUnchanged || metadataDirtyRef.current
    setIsDirty(dirty)
    isDirtyRef.current = dirty
  }

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags)
    metadataDirtyRef.current = true
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleMoodChange = (newMood: string) => {
    setMood(newMood || null)
    metadataDirtyRef.current = true
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleWeatherChange = (newWeather: string | null) => {
    setWeather(newWeather)
    metadataDirtyRef.current = true
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleFavoriteChange = (newIsFavorite: boolean) => {
    setIsFavorite(newIsFavorite)
    metadataDirtyRef.current = true
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const { loadImageUri } = useAttachmentImageLoader(services?.fileSystem)
  const { pickingImages, resolveAttachmentUrl, handlePickImages } = useDiaryEditorAttachments({
    services,
    selectedDate,
    content,
    loadImageUri,
    setIsDirty
  })

  const { handleBack } = useDiaryEditorExitGuard({
    navigation,
    dialog,
    router,
    t,
    isDirty,
    isDirtyRef,
    setIsDirty,
    dismissEditorKeyboard
  })

  return (
    <ScreenSafeArea preset="screen" style={{ backgroundColor: colors.bgSurface }}>
      <FullFileAccessGate granted={storageGranted} onRequest={() => void requestStorage()}>
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={colors.accentGreen} />
          </View>
        ) : (
          <DiaryEditor
            content={content}
            tags={tags}
            selectedDate={selectedDate}
            weather={weather || ''}
            mood={mood || ''}
            isFavorite={isFavorite}
            editorWebViewSource={editorWebViewSource}
            webViewActive
            onContentChange={handleContentChange}
            onTagsChange={handleTagsChange}
            tagColorRegistry={tagColorRegistry}
            onDateChange={handleDateChange}
            onWeatherChange={handleWeatherChange}
            onMoodChange={handleMoodChange}
            onFavoriteChange={handleFavoriteChange}
            onPickImages={handlePickImages}
            pickingImages={pickingImages}
            resolveAttachmentUrl={resolveAttachmentUrl}
            markdownToolbarOrder={toolOrder}
            onMarkdownToolbarOrderChange={saveToolOrder}
            onReadAloud={handleReadAloud}
            isTtsPlaying={ttsPlayingMsgId === DIARY_TTS_PLAYBACK_ID}
            onSave={handleSave}
            onCancel={handleBack}
          />
        )}
      </FullFileAccessGate>
    </ScreenSafeArea>
  )
}

const styles = StyleSheet.create({
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' }
})
