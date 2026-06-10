import React, { useState, useEffect, useCallback, useRef } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import { DiaryEditor, useNativeTheme, useDialog, useNativeToast } from '@baishou/ui/native'
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
import { FullFileAccessGate } from '../../components/FullFileAccessGate'
import {
  assertExternalStorageReady,
  isExternalStorageRequiredError
} from '../../services/storage-permission.service'
import { toFileUri } from '../../services/android-external-fs'

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
  const [pickingImages, setPickingImages] = useState(false)

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
          // 通过 id 查询日记
          const diary = await services.diaryService.findById(Number(id))
          if (diary) {
            setContent(diary.content)
            setOriginalContent(diary.content)
            setTags(typeof diary.tags === 'string' ? diary.tags.split(',') : diary.tags || [])
            setSelectedDate(diary.date)
            setWeather(diary.weather || null)
            setIsFavorite(diary.isFavorite || false)
            setExistingId(diary.id ?? null)
          }
        } else if (date) {
          // 按日期查询已有日记
          const existing = await services.diaryService.findByDate(new Date(date))
          if (existing) {
            setExistingId(existing.id ?? null)
            setTags(
              typeof existing.tags === 'string' ? existing.tags.split(',') : existing.tags || []
            )
            setSelectedDate(existing.date)
            setWeather(existing.weather || null)
            setIsFavorite(existing.isFavorite || false)

            // 如果是追加模式，保留原内容，在末尾追加
            if (append === '1') {
              const timeMark = resolveDiaryAppendBlock(templateConfig, now)
              setContent(existing.content + timeMark)
              setOriginalContent(existing.content)
            } else {
              setContent(existing.content)
              setOriginalContent(existing.content)
            }
          } else {
            setContent(resolveDiaryNewEntryContent(templateConfig, now))
            setSelectedDate(new Date(date))
          }
        } else {
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
  }, [id, date, append, dbReady, services])

  const handleSave = async () => {
    if (!services) return

    try {
      await assertExternalStorageReady()
      const input = {
        content,
        tags: tags.join(','),
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

  useEffect(() => {
    if (!services?.pathService) return
    const re = /!\[[^\]]*\]\((attachment\/[^)|\s]+)/g
    const srcs = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = re.exec(content)) !== null) {
      srcs.add(m[1]!)
    }
    if (srcs.size === 0) {
      setAttachmentUriMap({})
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const dir = await services.pathService!.getDiaryAttachmentDirectory(selectedDate)
        const map: Record<string, string> = {}
        for (const src of srcs) {
          const fileName = src.replace(/^attachment\//, '')
          map[src] = toFileUri(`${dir}/${fileName}`)
        }
        if (!cancelled) setAttachmentUriMap(map)
      } catch (e) {
        console.error('Failed to resolve diary attachment URIs:', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [content, selectedDate, services?.pathService])

  const resolveAttachmentUri = useCallback(
    (src: string) => {
      if (src.startsWith('attachment/')) {
        return attachmentUriMap[src] ?? null
      }
      return src
    },
    [attachmentUriMap]
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
