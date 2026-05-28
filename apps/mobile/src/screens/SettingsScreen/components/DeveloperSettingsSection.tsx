import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

export const DeveloperSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [busy, setBusy] = useState(false)

  const runAction = (title: string, message: string, action: () => Promise<void>) => {
    Alert.alert(title, message, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          if (!services || !dbReady) return
          setBusy(true)
          try {
            await action()
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e)
            Alert.alert(t('common.error'), message)
          } finally {
            setBusy(false)
          }
        }
      }
    ])
  }

  const handleLoadDemo = () => {
    runAction(t('developer.load_demo_data'), t('developer.load_demo_full_desc'), async () => {
      await services!.developerService.loadDemoData(services!.diaryService)
      Alert.alert(t('common.success'), t('developer.load_demo_success'))
    })
  }

  const handleClearAll = () => {
    runAction(t('developer.clear_warning_title'), t('developer.clear_warning_content'), async () => {
      services!.vaultFileWatcher.stop()
      const result = await services!.developerService.clearAllData({
        diaryService: services!.diaryService,
        pathService: services!.pathService,
        fileSystem: services!.fileSystem,
        vaultService: services!.vaultService,
        sessionManager: services!.sessionManager,
        assistantManager: services!.assistantManager
      })
      Alert.alert(
        result.success ? t('developer.clear_success_title') : t('common.error'),
        result.message || t('developer.clear_success_content')
      )
    })
  }

  const handleClearAgent = () => {
    runAction(t('developer.clear_agent_db'), t('developer.clear_agent_db_desc'), async () => {
      const result = await services!.developerService.clearAgentData({
        diaryService: services!.diaryService,
        pathService: services!.pathService,
        fileSystem: services!.fileSystem,
        vaultService: services!.vaultService,
        sessionManager: services!.sessionManager,
        assistantManager: services!.assistantManager
      })
      Alert.alert(
        result.success ? t('developer.clear_success') : t('common.error'),
        result.message || t('developer.clear_agent_success')
      )
    })
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('developer.debug_title')}
      </Text>

      {busy && <ActivityIndicator color={colors.primary} style={styles.spinner} />}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleLoadDemo}
        disabled={busy || !dbReady}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {t('developer.load_demo_data')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.error }]}
        onPress={handleClearAgent}
        disabled={busy || !dbReady}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {t('developer.clear_agent_db')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.error }]}
        onPress={handleClearAll}
        disabled={busy || !dbReady}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {t('developer.clear_all_data')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20
  },
  spinner: {
    marginBottom: 12
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
