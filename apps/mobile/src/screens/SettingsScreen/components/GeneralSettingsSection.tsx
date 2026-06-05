import React, { useEffect, useState, useCallback } from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import * as WebBrowser from 'expo-web-browser'
import { useTranslation } from 'react-i18next'
import { GITHUB_ISSUES_URL } from '@baishou/shared'
import { useNativeTheme, useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useStoragePermission } from '../../../hooks/useStoragePermission'
import {
  AboutSettingsCard,
  StorageSettingsCard,
  DataManagementCard,
  SettingsGroupDivider,
} from '@baishou/ui/native'
import {
  EXTERNAL_STORAGE_ROOT,
  isExternalStorageRequiredError
} from '../../../services/storage-permission.service'
import * as DocumentPicker from 'expo-document-picker'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

export const GeneralSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const { granted: storageGranted, request: requestStorageAccess } = useStoragePermission()

  const [storageRootPath, setStorageRootPath] = useState('...')

  const refreshStorageRoot = useCallback(async () => {
    if (!services?.pathService) return
    try {
      const root = await services.pathService.getRootDirectory()
      setStorageRootPath(displayPath(root))
    } catch (e) {
      if (isExternalStorageRequiredError(e)) {
        setStorageRootPath(displayPath(EXTERNAL_STORAGE_ROOT))
      } else {
        console.warn('Load storage root failed', e)
      }
    }
  }, [services])

  useEffect(() => {
    if (!dbReady || !services) return
    void refreshStorageRoot()
  }, [dbReady, services, refreshStorageRoot])

  useFocusEffect(
    useCallback(() => {
      void refreshStorageRoot()
    }, [refreshStorageRoot])
  )

  const handleExportData = async () => {
    if (!services || !dbReady) return
    const zipPath = await services.archiveService.exportToUserDevice()
    if (zipPath) {
      toast.showSuccess(t('settings.export_success_desc', { path: zipPath }))
    }
  }

  const handleImportData = async () => {
    if (!services || !dbReady) return
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
      const result = await services.archiveService.importFromZip(pick.assets[0].uri, true)
      if (result && (result.fileCount > 0 || result.fileCount === -1)) {
        toast.showSuccess(t('settings.restore_success_simple'))
      } else {
        toast.showWarning(t('common.no_data'))
      }
    } catch (e: any) {
      toast.showError(t('settings.import_failed_with_error', { error: e.message || '' }))
    }
  }

  return (
    <View style={styles.section}>
      <View
        style={[
          styles.groupCard,
          {
            backgroundColor: colors.bgSurface,
            borderRadius: tokens.radius.lg
          }
        ]}
      >
        <StorageSettingsCard
          embedded
          storageRootPath={storageRootPath}
          allFilesAccessGranted={Platform.OS === 'android' ? storageGranted : true}
          onRequestAllFilesAccess={() => void requestStorageAccess()}
        />
        <SettingsGroupDivider />

        <DataManagementCard embedded onExport={handleExportData} onImport={handleImportData} />
        <SettingsGroupDivider />

        <AboutSettingsCard
          embedded
          onNavigateAbout={() => router.push('/settings/about')}
          onNavigatePrivacy={() => router.push('/settings/privacy')}
          onOpenFeedback={() => void WebBrowser.openBrowserAsync(GITHUB_ISSUES_URL)}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  groupCard: {
    overflow: 'visible'
  }
})
