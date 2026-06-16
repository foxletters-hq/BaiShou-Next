import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { DiaryEditor, useNativeTheme, useDialog, useNativeToast } from '@baishou/ui/native'
import { mergeDiaryTags } from '@baishou/ai'
import {
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
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
import { extractDiaryAttachmentSrcs } from '@baishou/ui/native'
import {
  resolveDiaryAttachmentImageDataUri
} from '../../utils/mobile-diary-attachment-resolver'
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
  const [isFavorite, setIsFavorite] = useState(false)
  const [existingId, setExistingId] = useState<number | null>(null)
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const isDirtyRef = useRef(false)
  const originalTagsRef = useRef<string[]>([])
  const [pickingImages, setPickingImages] = useState(false)

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
      date: Date
      weather?: string | null
      isFavorite?: boolean
    },
    templateConfig: DiaryTemplateConfig,
    now: Date
  ) => {
    const parsedTags = parseDiaryTags(diary.tags)
    originalTagsRef.current = parsedTags
    setExistingId(diary.id ?? null)
    setSelectedDate(diary.date)
    setWeather(diary.weather || null)
    setIsFavorite(diary.isFavorite || false)

    if (isAppendMode) {
      const existing = (diary.content || '').trimEnd()
      const timeMark = resolveDiaryAppendBlock(templateConfig, now)
      setContent(existing ? existing + timeMark : timeMark.trimStart())
      setOriginalContent(existing)
      setTags([])
    } else {
      setContent(diary.content)
      setOriginalContent(diary.content)
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
            setContent(resolveDiaryNewEntryContent(templateConfig, now))
            setSelectedDate(new Date(date))
          }
        } else {
          originalTagsRef.current = []
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

    try {
      await assertExternalStorageReady()
      const mergedTags = isAppendMode
        ? mergeDiaryTags(originalTagsRef.current.join(', '), tags.join(','))
        : tags.join(',')
      const input = {
        content,
        tags: mergedTags,
        date: selectedDate,
        weather: weather || undefined,
        isFavorite
      }

      // 统一使用下沉到 DiaryService 中的 save 接口，自动处理新建、更新与冲突自动合并
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
    setContent(text)
    setIsDirty(true)
    isDirtyRef.current = true
  }

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags)
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

  const [attachmentUriMap, setAttachmentUriMap] = useState<Record<string, string>>({})
  const { loadImageUri } = useAttachmentImageLoader(services?.fileSystem)

  useEffect(() => {
    if (!services?.pathService || !services?.fileSystem) return
    const srcs = extractDiaryAttachmentSrcs(content)
    if (srcs.length === 0) {
      setAttachmentUriMap({})
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const map: Record<string, string> = {}
        for (const src of srcs) {
          const dataUri = await resolveDiaryAttachmentImageDataUri(
            services.pathService!,
            services.fileSystem,
            selectedDate,
            src,
            (absPath) => loadImageUri(absPath, 'preview')
          )
          if (dataUri) map[src] = dataUri
        }
        if (!cancelled) setAttachmentUriMap(map)
      } catch (e) {
        console.error('Failed to resolve diary attachment URIs:', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [content, selectedDate, services?.pathService, services?.fileSystem, loadImageUri])

  const resolveAttachmentUri = useCallback(
    (src: string) => {
      if (src.startsWith('attachment/')) {
        return attachmentUriMap[src] ?? null
      }
      return src
    },
    [attachmentUriMap]
  )

  const loadAttachmentImageUri = useCallback(
    async (src: string) => {
      if (!src.startsWith('attachment/') || !services?.pathService || !services?.fileSystem) {
        return null
      }
      const cached = attachmentUriMap[src]
      if (cached) return cached
      return resolveDiaryAttachmentImageDataUri(
        services.pathService,
        services.fileSystem,
        selectedDate,
        src,
        (absPath) => loadImageUri(absPath, 'preview')
      )
    },
    [attachmentUriMap, loadImageUri, selectedDate, services?.pathService, services?.fileSystem]
  )

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

  // 拦截系统返回键 / 侧滑返回手势
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
          isFavorite={isFavorite}
          onContentChange={handleContentChange}
          onTagsChange={handleTagsChange}
          onDateChange={setSelectedDate}
          onWeatherChange={handleWeatherChange}
          onFavoriteChange={handleFavoriteChange}
          onPickImages={handlePickImages}
          pickingImages={pickingImages}
          resolveAttachmentUri={resolveAttachmentUri}
          loadAttachmentImageUri={loadAttachmentImageUri}
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
