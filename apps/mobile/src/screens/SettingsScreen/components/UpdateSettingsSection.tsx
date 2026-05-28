import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import type { MobileUpdateCheckResult } from '../../../services/mobile-updater.service'

export const UpdateSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [autoCheck, setAutoCheck] = useState(true)
  const [checking, setChecking] = useState(false)
  const [lastResult, setLastResult] = useState<MobileUpdateCheckResult | null>(null)

  useEffect(() => {
    if (!dbReady || !services) return
    services.updaterService.getAutoCheck().then(setAutoCheck).catch(() => {})
  }, [dbReady, services])

  const handleToggleAutoCheck = async (value: boolean) => {
    if (!services) return
    setAutoCheck(value)
    await services.updaterService.setAutoCheck(value)
  }

  const handleCheckUpdate = async () => {
    if (!services || !dbReady) return
    setChecking(true)
    try {
      const result = await services.updaterService.checkForUpdates()
      setLastResult(result)

      if (result.status === 'available' && result.releaseUrl) {
        Alert.alert(
          t('updater.available', '发现新版本'),
          `v${result.latestVersion}`,
          [
            { text: t('common.cancel', '取消'), style: 'cancel' },
            {
              text: t('updater.view_release', '查看发布页'),
              onPress: () => {
                services.updaterService.openReleaseUrl(result.releaseUrl!).catch((e) => {
                  Alert.alert(t('common.error', '错误'), e?.message || String(e))
                })
              }
            }
          ]
        )
      } else if (result.status === 'not_available') {
        Alert.alert(t('updater.not_available', '已是最新版本'))
      } else if (result.status === 'error') {
        Alert.alert(t('updater.error', '检查更新失败'), result.error || '')
      }
    } finally {
      setChecking(false)
    }
  }

  const currentVersion = services?.updaterService.getCurrentVersion() ?? '—'

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {t('updater.section_title', '应用更新')}
      </Text>

      <View style={[styles.row, { borderColor: colors.borderSubtle }]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {t('updater.current_version', '当前版本')}
        </Text>
        <Text style={[styles.value, { color: colors.textSecondary }]}>v{currentVersion}</Text>
      </View>

      {lastResult?.latestVersion && (
        <View style={[styles.row, { borderColor: colors.borderSubtle }]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('updater.latest_version', '最新版本')}
          </Text>
          <Text style={[styles.value, { color: colors.textSecondary }]}>
            v{lastResult.latestVersion}
          </Text>
        </View>
      )}

      <View style={[styles.switchRow, { borderColor: colors.borderSubtle }]}>
        <View style={styles.switchText}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            {t('updater.auto_check', '自动检查更新')}
          </Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {t('updater.auto_check_desc', '启动时检查是否有新版本')}
          </Text>
        </View>
        <Switch
          value={autoCheck}
          onValueChange={handleToggleAutoCheck}
          disabled={!dbReady}
          trackColor={{ false: colors.borderSubtle, true: colors.primary }}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={handleCheckUpdate}
        disabled={checking || !dbReady}
      >
        {checking ? (
          <ActivityIndicator color={colors.textOnPrimary} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>
            {t('updater.check', '检查更新')}
          </Text>
        )}
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
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 4
  },
  label: {
    fontSize: 15,
    fontWeight: '600'
  },
  value: {
    fontSize: 15
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    marginBottom: 16
  },
  switchText: {
    flex: 1,
    marginRight: 12
  },
  hint: {
    fontSize: 13,
    marginTop: 4
  },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600'
  }
})
