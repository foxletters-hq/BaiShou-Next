import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as DocumentPicker from 'expo-document-picker'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'

export function useArchiveImportExport() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = useCallback(async () => {
    if (!services?.archiveService || !dbReady) {
      toast.showError(t('storage.service_unavailable', '归档服务未就绪'))
      return
    }
    const zipPath = await services.archiveService.exportToUserDevice()
    if (zipPath) {
      toast.showSuccess(t('settings.export_success_desc', { path: zipPath }))
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
      if (result && (result.fileCount > 0 || result.fileCount === -1)) {
        toast.showSuccess(t('settings.restore_success_simple'))
      } else {
        toast.showWarning(t('common.no_data'))
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(t('settings.import_failed_with_error', { error: message }))
    } finally {
      setIsImporting(false)
    }
  }, [dbReady, dialog, services, t, toast])

  return { handleExport, handleImport, isImporting, dbReady }
}
