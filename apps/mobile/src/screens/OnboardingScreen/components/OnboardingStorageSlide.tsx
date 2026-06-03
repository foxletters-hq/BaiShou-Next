import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { StoragePermissionPrompt, useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useStoragePermission } from '../../../hooks/useStoragePermission'
import { EXTERNAL_STORAGE_ROOT } from '../../../services/path.service'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

export const OnboardingStorageSlide: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { dbReady, storageReady } = useBaishou()
  const { granted, request, needsFullFileAccess } = useStoragePermission()
  const [rootPath, setRootPath] = useState('...')

  useEffect(() => {
    if (!dbReady) return
    if (storageReady && granted) {
      setRootPath(displayPath(EXTERNAL_STORAGE_ROOT))
      return
    }
    setRootPath(displayPath(EXTERNAL_STORAGE_ROOT))
  }, [dbReady, storageReady, granted])

  return (
    <View style={styles.container}>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>
        {t('onboarding.storage_desc_mobile')}
      </Text>

      <View style={[styles.pathCard, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.pathLabel, { color: colors.textSecondary }]}>
          {t('onboarding.current_storage')}
        </Text>
        {rootPath === '...' ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
        ) : (
          <Text style={[styles.pathValue, { color: colors.textPrimary }]} selectable>
            {rootPath}
          </Text>
        )}
      </View>

      {needsFullFileAccess && (
        <StoragePermissionPrompt onRequest={() => void request()} compact mode="required" />
      )}

      {granted === true && (
        <Text style={[styles.hint, { color: colors.primary }]}>
          {t('common.permission.storage_granted')}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 16
  },
  desc: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center'
  },
  pathCard: {
    padding: 16,
    borderRadius: 12
  },
  pathLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6
  },
  pathValue: {
    fontSize: 12,
    fontFamily: 'monospace'
  },
  hint: {
    fontSize: 13,
    textAlign: 'center'
  }
})
