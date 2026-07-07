import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import { isLikelyEditorBundleLeak } from '@baishou/ui/native'
import {
  composeDiaryEditorContent,
  formatLocalDate,
  joinDiaryContentWithAppendBlock,
  normalizeDiaryTagColorRegistry,
  parseDiaryEditorContent,
  resolveDiaryAppendBlock,
  resolveDiaryNewEntryContent,
  type DiaryTagColorRegistry,
  type DiaryTemplateConfig
} from '@baishou/shared'

type TranslateFn = TFunction

type ToastApi = {
  showError: (message: string) => void
}

type DiaryEditorLifecycleState = {
  setContent: Dispatch<SetStateAction<string>>
  setTags: Dispatch<SetStateAction<string[]>>
  setSelectedDate: Dispatch<SetStateAction<Date>>
  setExistingId: Dispatch<SetStateAction<number | null>>
  setWeather: Dispatch<SetStateAction<string | null>>
  setMood: Dispatch<SetStateAction<string | null>>
  setIsFavorite: Dispatch<SetStateAction<boolean>>
  setTagColorRegistry: Dispatch<SetStateAction<DiaryTagColorRegistry>>
  setOriginalContent: Dispatch<SetStateAction<string>>
  setIsDirty: Dispatch<SetStateAction<boolean>>
}

type DiaryEditorLifecycleRefs = {
  selectedDateRef: MutableRefObject<Date>
  loadedDateKeyRef: MutableRefObject<string | null>
  existingIdRef: MutableRefObject<number | null>
  isDirtyRef: MutableRefObject<boolean>
  metadataDirtyRef: MutableRefObject<boolean>
  savedEditorSnapshotRef: MutableRefObject<{ body: string; tags: string }>
  originalTagsRef: MutableRefObject<string[]>
  previousTagsRef: MutableRefObject<string[]>
}

export type CreateDiaryEditorLifecycleHandlersOptions = {
  isAppendMode: boolean
  normalizeDiaryCalendarDate: (date: Date) => Date
  state: DiaryEditorLifecycleState
  refs: DiaryEditorLifecycleRefs
  t: TranslateFn
  toast: ToastApi
}

function parseDiaryTags(raw: string | string[] | null | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function createDiaryEditorLifecycleHandlers({
  isAppendMode,
  normalizeDiaryCalendarDate,
  state,
  refs,
  t,
  toast
}: CreateDiaryEditorLifecycleHandlersOptions) {
  const {
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
  } = state

  const {
    selectedDateRef,
    loadedDateKeyRef,
    existingIdRef,
    isDirtyRef,
    metadataDirtyRef,
    savedEditorSnapshotRef,
    originalTagsRef,
    previousTagsRef
  } = refs

  const initBlankDiaryEntry = (
    templateConfig: DiaryTemplateConfig,
    now: Date,
    targetDate: Date
  ) => {
    loadedDateKeyRef.current = formatLocalDate(targetDate)
    originalTagsRef.current = []
    setTagColorRegistry({})
    const newContent = resolveDiaryNewEntryContent(templateConfig, now)
    setContent(newContent)
    savedEditorSnapshotRef.current = {
      body: parseDiaryEditorContent(newContent).body,
      tags: ''
    }
    metadataDirtyRef.current = false
    setIsDirty(false)
    isDirtyRef.current = false
    selectedDateRef.current = targetDate
    setSelectedDate(targetDate)
    setExistingId(null)
    existingIdRef.current = null
    setWeather(null)
    setMood(null)
    setIsFavorite(false)
    setTags([])
    previousTagsRef.current = []
    setOriginalContent('')
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
    const diaryDate = normalizeDiaryCalendarDate(diary.date)
    loadedDateKeyRef.current = formatLocalDate(diaryDate)
    setExistingId(diary.id ?? null)
    existingIdRef.current = diary.id ?? null
    selectedDateRef.current = diaryDate
    setSelectedDate(diaryDate)
    setWeather(diary.weather || null)
    setMood(diary.mood || null)
    setIsFavorite(diary.isFavorite || false)

    if (isAppendMode) {
      const safeExisting = isLikelyEditorBundleLeak(diary.content || '') ? '' : diary.content || ''
      const timeMark = resolveDiaryAppendBlock(templateConfig, now)
      const composed = joinDiaryContentWithAppendBlock(safeExisting, timeMark)
      setContent(composed)
      setOriginalContent(safeExisting.trimEnd())
      savedEditorSnapshotRef.current = {
        body: parseDiaryEditorContent(composed).body,
        tags: ''
      }
      metadataDirtyRef.current = false
      setIsDirty(false)
      isDirtyRef.current = false
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
      const composed = composeDiaryEditorContent(safeContent, parsedTags)
      const { tags: editorTags } = parseDiaryEditorContent(composed)
      setContent(composed)
      setOriginalContent(safeContent)
      savedEditorSnapshotRef.current = {
        body: parseDiaryEditorContent(composed).body,
        tags: editorTags.join(',')
      }
      metadataDirtyRef.current = false
      setIsDirty(false)
      isDirtyRef.current = false
      setTags(editorTags)
      previousTagsRef.current = editorTags
      originalTagsRef.current = editorTags.length > 0 ? editorTags : parsedTags
    }
  }

  return { initBlankDiaryEntry, applyLoadedDiary }
}
