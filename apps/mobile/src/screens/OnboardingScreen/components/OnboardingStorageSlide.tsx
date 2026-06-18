import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { StoragePermissionPrompt, useNativeToast } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import {
  EXTERNAL_STORAGE_ROOT,
  hasStoragePermission
} from '../../../services/storage-permission.service'
import { pickUserDirectory } from '../../../services/pick-directory.service'
import { toFileUri } from '../../../services/android-external-fs'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

interface OnboardingStorageSlideProps {
  granted: boolean | undefined
  permissionChecked: boolean
  needsFullFileAccess: boolean
  isStoragePending?: boolean
  mountFailed?: boolean
  onRequestPermission: () => Promise<boolean>
  onRetryMount?: () => void
}

export const OnboardingStorageSlide: React.FC<OnboardingStorageSlideProps> = ({
  granted,
  permissionChecked,
  needsFullFileAccess,
  isStoragePending = false,
  mountFailed = false,
  onRequestPermission,
  onRetryMount
}) => {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { dbReady, services } = useBaishou()
  const [rootPath, setRootPath] = useState(displayPath(EXTERNAL_STORAGE_ROOT))
  const [changing, setChanging] = useState(false)

  const refreshRootPath = useCallback(async () => {
    if (!services?.pathService) return
    try {
      const root = await services.pathService.getRootDirectory()
      setRootPath(displayPath(root))
    } catch {
      setRootPath(displayPath(EXTERNAL_STORAGE_ROOT))
    }
  }, [services])

  useEffect(() => {
    if (!dbReady) return
    if (Platform.OS === 'android' && granted !== true) {
      setRootPath(displayPath(EXTERNAL_STORAGE_ROOT))
      return
    }
    void refreshRootPath()
  }, [dbReady, granted, refreshRootPath])

  const handleChangeStorage = async () => {
    if (!services?.pathService) return

    if (Platform.OS === 'android') {
      const hasPermission = await hasStoragePermission()
      if (!hasPermission) {
        const ok = await onRequestPermission()
        if (!ok) return
      }
    }

    setChanging(true)
    try {
      const result = await pickUserDirectory()
      if (result.status === 'selected') {
        await services.pathService.updateRootDirectory(toFileUri(result.path))
        await refreshRootPath()
      }
    } catch {
      toast.showError(t('onboarding.storage_permission_error'))
    } finally {
      setChanging(false)
    }
  }

  const showPath = permissionChecked || Platform.OS !== 'android'

  return (
    <View style={styles.container}>
      {needsFullFileAccess && (
        <StoragePermissionPrompt
          onRequest={() => void onRequestPermission()}
          compact
          mode="required"
        />
      )}

      {isStoragePending && (
        <View style={styles.pendingRow}>
          <ActivityIndicator size="small" color="#D4924A" />
          <Text style={styles.pendingText}>{t('storage.mounting')}</Text>
        </View>
      )}

      {mountFailed && !isStoragePending && (
        <View style={styles.failedBlock}>
          <Text style={styles.failedText}>{t('storage.external_access_error')}</Text>
          {onRetryMount ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetryMount}
              activeOpacity={0.85}
            >
              <Text style={styles.retryButtonText}>{t('common.retry', '重试')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View style={styles.pathBlock}>
        <View style={styles.pathHeader}>
          <MaterialIcons name="folder-open" size={16} color="#D4924A" />
          <Text style={styles.pathLabel}>{t('onboarding.current_storage')}</Text>
        </View>
        {!showPath ? (
          <ActivityIndicator size="small" color="#D4924A" style={styles.loader} />
        ) : (
          <View style={styles.pathValueWrap}>
            <Text style={styles.pathValue} selectable>
              {rootPath}
            </Text>
          </View>
        )}
      </View>

      {granted === true && (
        <TouchableOpacity
          style={styles.changeButton}
          onPress={() => void handleChangeStorage()}
          disabled={changing}
          activeOpacity={0.85}
        >
          {changing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="edit-location-alt" size={18} color="#FFFFFF" />
              <Text style={styles.changeButtonText}>{t('onboarding.change_storage')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 20
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  pendingText: {
    fontSize: 14,
    color: '#6B5B45'
  },
  failedBlock: {
    alignItems: 'center',
    gap: 10
  },
  failedText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#B45309'
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFB74D'
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  pathBlock: {
    width: '100%',
    gap: 10
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  pathLabel: {
    fontWeight: '600',
    fontSize: 13,
    color: '#6B5B45'
  },
  pathValueWrap: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF'
  },
  pathValue: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: '#6B7280'
  },
  loader: {
    marginTop: 4,
    alignSelf: 'center'
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: '#FFB74D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  }
})
