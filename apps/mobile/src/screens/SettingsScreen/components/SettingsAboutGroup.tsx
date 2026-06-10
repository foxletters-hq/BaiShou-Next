import React from 'react'
import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useTranslation } from 'react-i18next'
import { GITHUB_ISSUES_URL } from '@baishou/shared'
import { AboutSettingsCard, SettingsGroupDivider, useNativeTheme } from '@baishou/ui/native'
import { UpdateSettingsSection } from './UpdateSettingsSection'

interface SettingsAboutGroupProps {
  groupCardStyle: ViewStyle
}

export const SettingsAboutGroup: React.FC<SettingsAboutGroupProps> = ({ groupCardStyle }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const router = useRouter()

  return (
    <View style={styles.groupBlock}>
      <Text style={[styles.groupTitle, { color: colors.textSecondary }]}>
        {t('settings.hub_group_about', '关于')}
      </Text>
      <View style={[styles.groupCard, groupCardStyle]}>
        <AboutSettingsCard
          embedded
          onNavigateAbout={() => router.push('/settings/about')}
          onNavigatePrivacy={() => router.push('/settings/privacy')}
          onOpenFeedback={() => void WebBrowser.openBrowserAsync(GITHUB_ISSUES_URL)}
        />
        <SettingsGroupDivider />
        <UpdateSettingsSection embedded />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  groupBlock: {
    gap: 8
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginLeft: 4,
    textTransform: 'uppercase'
  },
  groupCard: {
    overflow: 'hidden'
  }
})
