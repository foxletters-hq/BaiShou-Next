import React, { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import { GITHUB_REPO_URL, formatAppVersion } from '@baishou/shared'
import { scrollIndicatorStyle, useNativeTheme, useNativeToast, Button } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { AboutSettingsAboutContent, useAboutSettingsEasterEggs } from '@baishou/ui/native'
import { APP_VERSION_NUMBER } from '../../app-version'
import { copyDiagnosticLogToClipboard } from '../../services/mobile-diagnostic-log.service'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const HERO_IMAGE = require('@baishou/shared/assets/images/Next-1.0.0-banner.jpg')

export const AboutSettingsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const toast = useNativeToast()
  const chrome = getStackScreenChrome(colors)
  const router = useRouter()
  const [copyingLog, setCopyingLog] = useState(false)
  const easterEggs = useAboutSettingsEasterEggs({
    onDevModeUnlock: () => router.push('/settings/developer')
  })

  const version = Constants.expoConfig?.version ?? APP_VERSION_NUMBER

  const handleCopyDiagnosticLog = useCallback(async () => {
    if (copyingLog) return
    setCopyingLog(true)
    try {
      const length = await copyDiagnosticLogToClipboard()
      toast.showSuccess(
        t('about.copy_diagnostic_log_success', {
          count: String(length),
          defaultValue: '诊断日志已复制到剪贴板（{{count}} 字符）'
        })
      )
    } catch {
      toast.showError(t('about.copy_diagnostic_log_failed', '复制失败，请稍后重试'))
    } finally {
      setCopyingLog(false)
    }
  }, [copyingLog, t, toast])

  return (
    <StackScreenLayout
      title={t('settings.about_baishou', '关于白守')}
      {...chrome}
      contentStyle={styles.layoutContent}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        indicatorStyle={scrollIndicatorStyle(isDark)}
      >
        <AboutSettingsAboutContent
          version={formatAppVersion(version)}
          heroImageSrc={HERO_IMAGE}
          onOpenGithubHost={() => void WebBrowser.openBrowserAsync(GITHUB_REPO_URL)}
          onLogoTap={easterEggs.handleLogoTap}
          onDevTap={easterEggs.handleDevTap}
        />

        <View
          style={[
            styles.diagnosticCard,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderMuted
            }
          ]}
        >
          <Text style={[styles.diagnosticTitle, { color: colors.textPrimary }]}>
            {t('about.copy_diagnostic_log', '复制诊断日志')}
          </Text>
          <Text style={[styles.diagnosticDesc, { color: colors.textSecondary }]}>
            {t(
              'about.copy_diagnostic_log_desc',
              '复制最近的应用日志，便于反馈闪退等问题。若刚发生闪退，请先重新打开 App 再复制。'
            )}
          </Text>
          <Button
            variant="secondary"
            className="w-full"
            onPress={() => void handleCopyDiagnosticLog()}
            isDisabled={copyingLog}
          >
            {copyingLog
              ? t('common.processing', '处理中…')
              : t('about.copy_diagnostic_log_action', '复制到剪贴板')}
          </Button>
        </View>
      </ScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16
  },
  diagnosticCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10
  },
  diagnosticTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  diagnosticDesc: {
    fontSize: 13,
    lineHeight: 19
  }
})
