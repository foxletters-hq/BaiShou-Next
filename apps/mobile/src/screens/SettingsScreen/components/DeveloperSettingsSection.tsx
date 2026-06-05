import React, { useState } from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme, useNativeToast, useDialog, Button } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

export const DeveloperSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady } = useBaishou()
  const [busy, setBusy] = useState(false)

  const runAction = (title: string, message: string, action: () => Promise<void>) => {
    void (async () => {
      const confirmed = await dialog.confirm(message, {
        title,
        confirmText: t('common.confirm'),
        destructive: true
      })
      if (!confirmed || !services || !dbReady) return
      setBusy(true)
      try {
        await action()
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        toast.showError(errMsg)
      } finally {
        setBusy(false)
      }
    })()
  }

  const handleLoadDemo = () => {
    runAction(t('developer.load_demo_data'), t('developer.load_demo_full_desc'), async () => {
      await services!.developerService.loadDemoData(services!.diaryService)
      toast.showSuccess(t('developer.load_demo_success'))
    })
  }

  const handleClearAll = () => {
    runAction(
      t('developer.clear_warning_title'),
      t('developer.clear_warning_content'),
      async () => {
        services!.vaultFileWatcher.stop()
        const result = await services!.developerService.clearAllData({
          diaryService: services!.diaryService,
          pathService: services!.pathService,
          fileSystem: services!.fileSystem,
          vaultService: services!.vaultService,
          sessionManager: services!.sessionManager,
          assistantManager: services!.assistantManager
        })
        if (result.success) {
          toast.showSuccess(result.message || t('developer.clear_success_content'))
        } else {
          toast.showError(result.message || t('common.error'))
        }
      }
    )
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
      if (result.success) {
        toast.showSuccess(result.message || t('developer.clear_agent_success'))
      } else {
        toast.showError(result.message || t('common.error'))
      }
    })
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('developer.debug_title')}
      </Text>

      {busy && <ActivityIndicator color={colors.primary} style={styles.spinner} />}

      <Button
        variant="primary"
        className="w-full"
        onPress={handleLoadDemo}
        isDisabled={busy || !dbReady}
        style={styles.button}
      >
        {t('developer.load_demo_data')}
      </Button>

      <Button
        variant="danger"
        className="w-full"
        onPress={handleClearAgent}
        isDisabled={busy || !dbReady}
        style={styles.button}
      >
        {t('developer.clear_agent_db')}
      </Button>

      <Button
        variant="danger"
        className="w-full"
        onPress={handleClearAll}
        isDisabled={busy || !dbReady}
        style={styles.button}
      >
        {t('developer.clear_all_data')}
      </Button>
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
    marginBottom: 12
  }
})
