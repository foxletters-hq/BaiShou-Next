import React, { useState } from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { SettingsItem } from '../SettingsItem'
import type { NativeAboutSettingsCardProps } from './about-settings.types'
import { useAboutSettingsEasterEggs } from './useAboutSettingsEasterEggs'
import { AboutSettingsAboutContent } from './AboutSettingsAboutContent'
import { AboutSettingsPrivacyContent } from './AboutSettingsPrivacyContent'
import { AboutSettingsFullscreenPanel } from './AboutSettingsFullscreenPanel'

export const AboutSettingsCard: React.FC<NativeAboutSettingsCardProps> = ({
  version,
  heroImageSrc,
  onOpenGithubHost
}) => {
  const { t } = useTranslation()
  const { tokens } = useNativeTheme()
  const [showAbout, setShowAbout] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const easterEggs = useAboutSettingsEasterEggs()

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <SettingsItem
        icon={<Text style={{ fontSize: 20 }}>ℹ️</Text>}
        title={t('settings.about_baishou', '关于白守')}
        onPress={() => setShowAbout(true)}
      />

      <SettingsItem
        icon={<Text style={{ fontSize: 20 }}>🔒</Text>}
        title={t('settings.development_philosophy', '开发哲学与无痕承诺')}
        onPress={() => setShowPrivacy(true)}
      />

      <SettingsItem
        icon={<Text style={{ fontSize: 20 }}>🐛</Text>}
        title={t('settings.feedback', '问题反馈')}
        onPress={onOpenGithubHost}
      />

      <AboutSettingsFullscreenPanel visible={showAbout} onClose={() => setShowAbout(false)}>
        <AboutSettingsAboutContent
          version={version}
          heroImageSrc={heroImageSrc}
          onOpenGithubHost={onOpenGithubHost}
          onLogoTap={easterEggs.handleLogoTap}
          onDevTap={easterEggs.handleDevTap}
        />
      </AboutSettingsFullscreenPanel>

      <AboutSettingsFullscreenPanel visible={showPrivacy} onClose={() => setShowPrivacy(false)}>
        <AboutSettingsPrivacyContent />
      </AboutSettingsFullscreenPanel>
    </View>
  )
}
