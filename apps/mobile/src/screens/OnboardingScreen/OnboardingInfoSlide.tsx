import React from 'react'
import { View, Text } from 'react-native'
import { useNativeTheme } from '@baishou/ui/native'
import { OnboardingGlowIcon } from './components/OnboardingGlowIcon'
import { styles } from './OnboardingScreen.styles'
import type { SlideTheme } from './onboarding-theme'

type OnboardingInfoSlideProps = {
  theme: SlideTheme
  title: string
  body: string
  slogan?: string
}

/** 纯文案类引导页（理念/压缩/API/隐私） */
export function OnboardingInfoSlide({ theme, title, body, slogan }: OnboardingInfoSlideProps) {
  const { colors } = useNativeTheme()
  return (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={theme} />
      <View style={styles.slideSpacerLarge} />
      <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>{title}</Text>
      <View style={styles.slideSpacerMedium} />
      <Text style={[styles.slideBody, { color: colors.textSecondary }]}>{body}</Text>
      {slogan ? (
        <>
          <View style={styles.sloganSpacer} />
          <Text style={[styles.slogan, { color: colors.textSecondary }]}>{slogan}</Text>
        </>
      ) : null}
    </View>
  )
}
