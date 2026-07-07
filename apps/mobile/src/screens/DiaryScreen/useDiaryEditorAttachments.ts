import { useCallback, useEffect, useRef, useState } from 'react'
import type { Router } from 'expo-router'
import type { useDialog } from '@baishou/ui/native'
import type { TFunction } from 'i18next'
import {
  getDiaryInsertMarkdown,
  pickDiaryImagesFromLibrary,
  uploadDiaryAttachments
} from '../../services/mobile-diary-attachment.service'
import { resolveDiaryAttachmentUrlForWebView } from '../../services/diary-cm-attachment-url.service'
import { extractDiaryAttachmentRefs } from '../../utils/diary-attachment-prefetch.util'
import { clearDiaryAttachmentAbsPathCache } from '../../utils/mobile-diary-attachment-resolver'
import type { AttachmentImagePurpose } from '../../utils/mobile-attachment-image-cache'
import type { useBaishou } from '../../providers/BaishouProvider'

type BaishouServices = NonNullable<ReturnType<typeof useBaishou>['services']>

export function useDiaryEditorAttachments(options: {
  services: BaishouServices | null | undefined
  selectedDate: Date
  content: string
  loadImageUri: (absPath: string, purpose?: AttachmentImagePurpose) => Promise<string | null>
  setIsDirty: (v: boolean) => void
}) {
  const { services, selectedDate, content, loadImageUri, setIsDirty } = options
  const [pickingImages, setPickingImages] = useState(false)
  const attachmentCacheRef = useRef<Record<string, string>>({})

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
  }, [services?.pathService, services?.fileSystem, selectedDate, setIsDirty])

  return { pickingImages, resolveAttachmentUrl, handlePickImages }
}

export function useDiaryEditorExitGuard(options: {
  navigation: {
    addListener: (
      type: 'beforeRemove',
      callback: (e: { preventDefault: () => void }) => void
    ) => () => void
  }
  dialog: ReturnType<typeof useDialog>
  router: Router
  t: TFunction
  isDirty: boolean
  isDirtyRef: React.MutableRefObject<boolean>
  setIsDirty: (v: boolean) => void
  dismissEditorKeyboard: () => void
}) {
  const { navigation, dialog, router, t, isDirty, isDirtyRef, setIsDirty, dismissEditorKeyboard } =
    options

  const handleBack = useCallback(async () => {
    if (isDirty) {
      const confirmed = await dialog.confirm(t('diary.exit_confirmation_hint'), {
        confirmText: t('diary.exit_without_saving_confirm'),
        destructive: true
      })
      if (confirmed) {
        setIsDirty(false)
        isDirtyRef.current = false
        dismissEditorKeyboard()
        router.back()
      }
    } else {
      dismissEditorKeyboard()
      router.back()
    }
  }, [dialog, dismissEditorKeyboard, isDirty, isDirtyRef, router, setIsDirty, t])

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      dismissEditorKeyboard()
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
          dismissEditorKeyboard()
          router.back()
        }
      })()
    })
    return unsub
  }, [navigation, dialog, t, router, dismissEditorKeyboard, isDirtyRef, setIsDirty])

  return { handleBack }
}
