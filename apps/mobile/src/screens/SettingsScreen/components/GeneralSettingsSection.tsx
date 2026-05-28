import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useStoragePermission } from '../../../hooks/useStoragePermission'
import {
  AboutSettingsCard,
  WorkspaceSettingsCard,
  StorageSettingsCard,
  type VaultInfo
} from '@baishou/ui/native'

export interface GeneralSettingsSectionProps {
  onNavigateToAttachments: () => void
}

export const GeneralSettingsSection: React.FC<GeneralSettingsSectionProps> = ({
  onNavigateToAttachments
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const { granted: storageGranted, request: requestStorageAccess } = useStoragePermission()

  const [storageStats, setStorageStats] = useState<any>({})
  const [vaults, setVaults] = useState<VaultInfo[]>([])
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null)

  const loadVaults = async () => {
    if (!services || !dbReady) return
    try {
      const allVaults = await services.vaultService.getAllVaults()
      const active = await services.vaultService.getActiveVault()
      setVaults(
        allVaults.map((v) => ({
          name: v.name,
          path: v.path,
          createdAt: v.createdAt,
          lastAccessedAt: v.lastAccessedAt
        }))
      )
      if (active) {
        setActiveVault({
          name: active.name,
          path: active.path,
          createdAt: active.createdAt,
          lastAccessedAt: active.lastAccessedAt
        })
      }
    } catch (e) {
      console.warn('Load vaults failed', e)
    }
  }

  useEffect(() => {
    if (!dbReady || !services) return
    const loadSettings = async () => {
      try {
        const storageStatsData = (await services.settingsManager.get<any>('storage_stats')) || {}
        setStorageStats(storageStatsData)
      } catch (e) {
        console.warn('Load general settings failed', e)
      }
    }
    loadSettings()
    loadVaults()
  }, [dbReady, services])

  const handleSwitchVault = async (name: string) => {
    if (!services || !dbReady) return
    try {
      await services.vaultService.switchVault(name)
      await loadVaults()
      Alert.alert(t('common.success'), t('common.save_success'))
    } catch (e) {
      Alert.alert(t('common.error'), t('common.errors.save_failed'))
    }
  }

  const handleDeleteVault = async (name: string) => {
    if (!services || !dbReady) return
    try {
      await services.vaultService.deleteVault(name)
      await loadVaults()
    } catch (e) {
      Alert.alert(t('common.error'), t('common.errors.save_failed'))
    }
  }

  const handleCreateVault = async (name: string) => {
    if (!services || !dbReady) return
    try {
      await services.vaultService.switchVault(name)
      await loadVaults()
    } catch (e) {
      throw e
    }
  }

  const handleExportData = async () => {
    if (!services || !dbReady) return
    try {
      const zipPath = await services.archiveService.exportToUserDevice()
      if (zipPath) {
        Alert.alert(t('common.success'), t('settings.export_success_desc', { path: '' }))
      }
    } catch (e) {
      Alert.alert(t('common.error'), t('settings.export_failed', { error: '' }))
    }
  }

  const handleImportData = async () => {
    if (!services || !dbReady) return
    try {
      Alert.alert(
        t('settings.confirm_restore'),
        t('settings.confirm_restore_desc'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.confirm'),
            style: 'destructive',
            onPress: async () => {
              try {
                const result = await services.archiveService.importFromZip('', true)
                if (result && (result.fileCount > 0 || result.fileCount === -1)) {
                  Alert.alert(
                    t('common.success'),
                    t('settings.restore_success_simple')
                  )
                } else {
                  Alert.alert(
                    t('common.hint'),
                    t('common.no_data')
                  )
                }
              } catch (e2: any) {
                Alert.alert(
                  t('common.error'),
                  t('settings.import_failed_with_error', { error: e2.message || '' })
                )
              }
            }
          }
        ]
      )
    } catch (e) {
      console.error('Import failed', e)
    }
  }

  return (
    <View style={styles.section}>
      <WorkspaceSettingsCard
        vaults={vaults}
        activeVault={activeVault}
        onSwitch={handleSwitchVault}
        onDelete={handleDeleteVault}
        onCreate={handleCreateVault}
      />

      <StorageSettingsCard
        storageRootPath={storageStats.storageRootPath}
        sqliteSizeStats={storageStats.sqliteSizeStats || '0 MB'}
        vectorDbStats={storageStats.vectorDbStats || '0 MB'}
        mediaCacheStats={storageStats.mediaCacheStats || '0 MB'}
        onNavigateToAttachments={onNavigateToAttachments}
        allFilesAccessGranted={Platform.OS === 'android' ? storageGranted : true}
        onRequestAllFilesAccess={() => void requestStorageAccess()}
      />

      <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 16 }]}>
        {t('settings.data_management')}
      </Text>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleExportData}
      >
        <Text style={[styles.actionButtonText, { color: colors.textOnPrimary }]}>
          {t('settings.export_data')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={handleImportData}
      >
        <Text style={[styles.actionButtonText, { color: colors.textPrimary }]}>
          {t('settings.import_data')}
        </Text>
      </TouchableOpacity>

      <AboutSettingsCard version="2.0.0-Next-Canary" onOpenGithubHost={() => {}} />
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
