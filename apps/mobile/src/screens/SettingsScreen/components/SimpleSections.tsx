import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/src/native/theme'
import { useBaishou } from '../../providers/BaishouProvider'
import { useRouter } from 'expo-router'

export const AssistantsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.assistants', '伙伴管理')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.assistants_desc', '管理AI助手和伙伴')}
      </Text>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/assistants')}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
          {t('settings.manage_assistants', '管理助手')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export const LanTransferSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.lan_title', '局域网传输')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.lan_desc', '配置局域网同步和传输')}
      </Text>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/lan-transfer')}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
          {t('settings.start_transfer', '开始传输')}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

export const DataSyncSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()

  const handleSyncNow = async () => {
    if (!services || !dbReady) return
    if (!services.cloudSyncService) {
      Alert.alert(
        t('common.error', '错误'),
        t('settings.sync_service_unavailable', '同步服务不可用')
      )
      return
    }

    // 获取第一个启用的同步目标
    const targets = (await services.settingsManager.get<any[]>('sync_targets')) || []
    const enabledTarget = targets.find((target) => target.isEnabled)

    if (!enabledTarget) {
      Alert.alert(t('common.hint', '提示'), t('settings.no_sync_target', '请先配置同步目标'))
      return
    }

    try {
      // 构建同步配置
      const syncConfig = {
        target: enabledTarget.type,
        maxBackupCount: 5,
        webdavUrl: enabledTarget.url,
        webdavUsername: enabledTarget.username || '',
        webdavPassword: '',
        webdavPath: '/',
        s3Endpoint: enabledTarget.url,
        sRegion: '',
        s3Bucket: '',
        s3Path: '',
        s3AccessKey: enabledTarget.username || '',
        s3SecretKey: ''
      }

      Alert.alert(t('settings.syncing', '同步中'), t('settings.syncing_message', '正在同步数据...'))

      const result = await services.cloudSyncService.syncNow(syncConfig)

      Alert.alert(
        result.success ? t('common.success', '成功') : t('common.error', '错误'),
        result.message
      )
    } catch (e) {
      Alert.alert(t('common.error', '错误'), t('settings.sync_failed', '同步失败'))
    }
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('settings.sync_title', '数据同步')}
      </Text>
      <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
        {t('settings.sync_desc', '配置云同步和备份')}
      </Text>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: colors.primary }]}
        onPress={handleSyncNow}
      >
        <Text style={[styles.actionButtonText, { color: '#FFF' }]}>
          {t('settings.sync_now', '立即同步')}
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
