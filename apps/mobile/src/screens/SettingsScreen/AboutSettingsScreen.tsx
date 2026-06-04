import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as WebBrowser from 'expo-web-browser'
import Constants from 'expo-constants'
import { GITHUB_REPO_URL, formatAppVersion } from '@baishou/shared'
import { scrollIndicatorStyle, useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { AboutSettingsAboutContent, useAboutSettingsEasterEggs } from '@baishou/ui/native'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const HERO_IMAGE = require('@baishou/shared/assets/images/Next-1.0.0-banner.jpg')

export const AboutSettingsScreen: React.FC = () => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const router = useRouter()
  const easterEggs = useAboutSettingsEasterEggs({
    onDevModeUnlock: () => router.push('/settings/developer')
  })

  const version = Constants.expoConfig?.version ?? '1.0.0'

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
      </ScrollView>
    </StackScreenLayout>
  )
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32
  }
})
