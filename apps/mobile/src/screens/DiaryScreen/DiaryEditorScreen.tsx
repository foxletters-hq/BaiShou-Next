import React, { useState, useEffect, useCallback } from 'react'
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { ScreenSafeArea } from '../../components/ScreenSafeArea'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { DiaryEditor, useNativeTheme } from '@baishou/ui/native'
import { format } from 'date-fns'
import { useBaishou } from '../../providers/BaishouProvider'
import {
  getDiaryInsertMarkdown,
  pickDiaryImagesFromLibrary,
  uploadDiaryAttachments
} from '../../services/mobile-diary-attachment.service'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { FullFileAccessGate } from '../../components/FullFileAccessGate'
import { assertExternalStorageReady, isExternalStorageRequiredError } from '../../services/storage-permission.service'
import { toFileUri } from '../../services/android-external-fs'

export const DiaryEditorScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { id, date, append } = useLocalSearchParams<{
    id?: string
    date?: string
    append?: string
  }>()
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const { granted: storageGranted, request: requestStorage } = useStoragePermission()

  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [weather, setWeather] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [existingId, setExistingId] = useState<number | null>(null)
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [pickingImages, setPickingImages] = useState(false)

  useEffect(() => {
    if (!dbReady || !services) return

    const fetchDiary = async () => {
      try {
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
              const timeMark = `\n\n##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
              setContent(existing.content + timeMark)
              setOriginalContent(existing.content)
            } else {
              setContent(existing.content)
              setOriginalContent(existing.content)
            }
          } else {
            // 新建日记，设置初始时间标记
            const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
            setContent(timeMark)
            setSelectedDate(new Date(date))
          }
        } else {
          // 没有 id 和 date，新建日记
          const timeMark = `##### ${format(new Date(), 'HH:mm:ss')}\n\n\u200B`
          setContent(timeMark)
        }
      } catch (e) {
        console.error('Failed to load diary:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchDiary()
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
      router.back()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (isExternalStorageRequiredError(e) || msg.includes('expo-file-system') || msg.includes('原生存储')) {
        Alert.alert(
          t('storage.all_files_access_title'),
          msg.includes('pnpm dev:mobile:clear')
            ? msg
            : t('storage.all_files_access_settings_hint'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.check_storage_permission'), onPress: () => void requestStorage() }
          ]
        )
        return
      }
      if (msg.includes('BaiShou_Root') && msg.includes('externalMakeDirectory')) {
        Alert.alert(t('common.error'), msg)
        return
      }
      console.error('Failed to save diary:', e)
      Alert.alert(t('common.error'), msg || t('diary.save_failed'))
    }
  }

  const handleContentChange = (text: string) => {
    setContent(text)
    setIsDirty(true)
  }

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags)
    setIsDirty(true)
  }

  const handleWeatherChange = (newWeather: string | null) => {
    setWeather(newWeather)
    setIsDirty(true)
  }

  const handleFavoriteChange = (newIsFavorite: boolean) => {
    setIsFavorite(newIsFavorite)
    setIsDirty(true)
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

  const handleBack = () => {
    if (isDirty) {
      Alert.alert(t('diary.exit_without_saving'), t('diary.exit_confirmation_hint'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('diary.exit_without_saving_confirm'),
          style: 'destructive',
          onPress: () => router.back()
        }
      ])
    } else {
      router.back()
    }
  }

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
