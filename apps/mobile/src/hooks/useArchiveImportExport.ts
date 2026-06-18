import { useCallback, useState } from 'react'
import { InteractionManager } from 'react-native'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { applyArchiveImportFeedback } from '../utils/archive-restore-feedback'
import {
  buildArchiveImportProgress,
  formatArchiveExportErrorMessage,
  reportArchiveImportStage,
  resolveArchiveImportStageDetail,
  resolveArchiveImportStageHint,
  resolveArchiveImportStageMessage,
  type ArchiveImportProgress
} from '../services/archive-guards.util'

/** 分享面板关闭后立即弹 Toast 会在部分 Android 上触发 SafeArea/Reanimated 视图竞态崩溃 */
function waitForShareSheetDismiss(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, 350)
    })
  })
}

function formatExportFailedToast(
  t: (key: string, options?: Record<string, string>) => string,
  error: unknown
): string {
  const detail = formatArchiveExportErrorMessage(error)
  const localized = t('settings.export_failed', { error: detail })
  if (localized.includes('{{error}}')) {
    return `导出失败：${detail}`
  }
  return localized
}

const IMPORT_SUCCESS_DISMISS_MS = 900

export function useArchiveImportExport() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, notifyArchiveRestoreComplete } = useBaishou()
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<ArchiveImportProgress | null>(null)

  const handleExport = useCallback(async () => {
    if (!services?.archiveService || !dbReady) {
      toast.showError(t('storage.service_unavailable', '归档服务未就绪'))
      return
    }

    try {
      await services.archiveService.exportToUserDevice()
      await waitForShareSheetDismiss()
      toast.showSuccess(t('settings.export_success', '导出成功'))
    } catch (e: unknown) {
      toast.showError(formatExportFailedToast(t, e))
    }
  }, [dbReady, services, t, toast])

  const handleImport = useCallback(async () => {
    if (!services?.archiveService || !dbReady) {
      toast.showError(t('storage.service_unavailable', '归档服务未就绪'))
      return
    }

    const confirmed = await dialog.confirm(t('settings.confirm_restore_desc'), {
      confirmText: t('common.confirm'),
      destructive: true
    })
    if (!confirmed) return

    setIsImporting(true)
    setImportProgress(buildArchiveImportProgress('preparing'))

    try {
      reportArchiveImportStage(setImportProgress, 'reading_file')
      const pick = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true
      })
      if (pick.canceled || !pick.assets?.[0]?.uri) {
        return
      }

      const result = await services.archiveService.importFromZip(
        pick.assets[0].uri,
        true,
        (progress) => setImportProgress(progress)
      )

      reportArchiveImportStage(setImportProgress, 'succeeded', { percent: 100 })
      applyArchiveImportFeedback(result, t, toast, notifyArchiveRestoreComplete)
      await new Promise((resolve) => setTimeout(resolve, IMPORT_SUCCESS_DISMISS_MS))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      setImportProgress(
        buildArchiveImportProgress('failed', {
          percent: 100,
          detail: message
        })
      )
      toast.showError(t('settings.import_failed_with_error', { error: message }))
      await new Promise((resolve) => setTimeout(resolve, IMPORT_SUCCESS_DISMISS_MS))
    } finally {
      setIsImporting(false)
      setImportProgress(null)
    }
  }, [dbReady, dialog, notifyArchiveRestoreComplete, services, t, toast])

  const importMessage = importProgress
    ? resolveArchiveImportStageMessage(importProgress)
    : undefined
  const importHint = importProgress ? resolveArchiveImportStageHint(importProgress) : undefined
  const importDetail = importProgress ? resolveArchiveImportStageDetail(importProgress) : undefined
  const importPercent = importProgress?.percent
  const importSucceeded = importProgress?.stage === 'succeeded'
  const importFailed = importProgress?.stage === 'failed'

  return {
    handleExport,
    handleImport,
    isImporting,
    importMessage,
    importHint,
    importDetail,
    importPercent,
    importSucceeded,
    importFailed,
    dbReady
  }
}
