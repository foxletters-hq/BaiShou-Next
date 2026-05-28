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
      { text: t('common.cancel', '取消'), style: 'cancel' },
      {
        text: t('common.confirm', '确认'),
        style: 'destructive',
        onPress: async () => {
          if (!services || !dbReady) return
          setBusy(true)
          try {
            await action()
          } catch (e: any) {
            Alert.alert(t('common.error', '错误'), e?.message || String(e))
          } finally {
            setBusy(false)
          }
        }
      }
    ])
  }

  const handleLoadDemo = () => {
    runAction(
      t('settings.dev_load_demo', '加载演示数据'),
      t('settings.dev_load_demo_confirm', '将写入若干示例日记（已存在日期的会追加内容）。'),
      async () => {
        await services!.developerService.loadDemoData(services!.diaryService)
        Alert.alert(t('common.success', '成功'), t('settings.dev_load_demo_done', '演示数据已加载'))
      }
    )
  }

  const handleClearAll = () => {
    runAction(
      t('settings.dev_clear_all', '清空全部数据'),
      t(
        'settings.dev_clear_all_confirm',
        '将删除本地存储与数据库，操作不可恢复。完成后需重启应用。'
      ),
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
        Alert.alert(
          result.success ? t('common.success', '成功') : t('common.error', '错误'),
          result.message || ''
        )
      }
    )
  }

  const handleClearAgent = () => {
    runAction(
      t('settings.dev_clear_agent', '清空 Agent 数据'),
      t('settings.dev_clear_agent_confirm', '将删除所有会话与助手配置，操作不可恢复。'),
      async () => {
        const result = await services!.developerService.clearAgentData({
          diaryService: services!.diaryService,
          pathService: services!.pathService,
          fileSystem: services!.fileSystem,
          vaultService: services!.vaultService,
          sessionManager: services!.sessionManager,
          assistantManager: services!.assistantManager
        })
        Alert.alert(
          result.success ? t('common.success', '成功') : t('common.error', '错误'),
          result.message || ''
        )
      }
    )
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.developer', '开发者')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.developer_desc', '演示数据与危险操作，仅供调试使用。')}
      </Text>

      {busy && <ActivityIndicator color={colors.primary} style={styles.spinner} />}

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleLoadDemo}
        disabled={busy || !dbReady}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {t('settings.dev_load_demo', '加载演示数据')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.error }]}
        onPress={handleClearAgent}
        disabled={busy || !dbReady}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {t('settings.dev_clear_agent', '清空 Agent 数据')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.error }]}
        onPress={handleClearAll}
        disabled={busy || !dbReady}
      >
        <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
          {t('settings.dev_clear_all', '清空全部数据')}
        </Text>
      </TouchableOpacity>
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
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16
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
