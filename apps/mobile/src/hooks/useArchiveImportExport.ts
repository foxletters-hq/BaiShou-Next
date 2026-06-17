import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { applyArchiveImportFeedback } from '../utils/archive-restore-feedback'
import { formatArchiveExportErrorMessage } from '../services/archive-guards.util'

function formatExportFailedToast(t: (key: string, options?: Record<string, string>) => string, error: unknown): string {
  const detail = formatArchiveExportErrorMessage(error)
  const localized = t('settings.export_failed', { error: detail })
  if (localized.includes('{{error}}')) {
    return `导出失败：${detail}`
  }
  return localized
}

export function useArchiveImportExport() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, notifyArchiveRestoreComplete } = useBaishou()
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = useCallback(async () => {
    if (!services?.archiveService || !dbReady) {
      toast.showError(t('storage.service_unavailable', '归档服务未就绪'))
      return
    }

    try {
      await services.archiveService.exportToUserDevice()
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

    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true
      })
      if (pick.canceled || !pick.assets?.[0]?.uri) return

      setIsImporting(true)
      const result = await services.archiveService.importFromZip(pick.assets[0].uri, true)
      applyArchiveImportFeedback(result, t, toast, notifyArchiveRestoreComplete)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(t('settings.import_failed_with_error', { error: message }))
    } finally {
      setIsImporting(false)
    }
  }, [dbReady, dialog, notifyArchiveRestoreComplete, services, t, toast])

  return { handleExport, handleImport, isImporting, dbReady }
}
