import React from 'react'
import { View, Text, Animated, Image, StyleSheet, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { BRAND_BLUE_DARK } from '../onboarding-theme'
import {
  displaySizes,
  mobileTypography,
  settingsTypography,
  sharedTokens
} from '@baishou/ui/theme/tokens'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_ICON = require('../../../../assets/images/icon.png') as number

type OnboardingWelcomeSlideProps = {
  welcomeScale: Animated.AnimatedInterpolation<number>
}

export const OnboardingWelcomeSlide: React.FC<OnboardingWelcomeSlideProps> = ({ welcomeScale }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={styles.slideInner}>
      <Animated.View
        style={[
          styles.welcomeIconWrap,
          { backgroundColor: colors.bgSurface, transform: [{ scale: welcomeScale }] }
        ]}
      >
        <Image source={APP_ICON} style={styles.welcomeIcon} resizeMode="cover" />
      </Animated.View>
      <Text style={styles.welcomeTitle}>{t('onboarding.welcome_title')}</Text>
      <Text style={styles.welcomeTagline}>{t('onboarding.welcome_tagline')}</Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {t('onboarding.welcome_desc')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  slideInner: {
    alignItems: 'center',
    width: '100%'
  },
  welcomeIconWrap: {
    width: 140,
    height: 140,
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#9AD4EA',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 30
      },
      default: {}
    })
  },
  welcomeIcon: {
    width: 140,
    height: 140,
    borderRadius: 32
  },
  welcomeTitle: {
    marginTop: sharedTokens.spacing.xlPlus,
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: BRAND_BLUE_DARK
  },
  welcomeTagline: {
    marginTop: sharedTokens.spacing.mdTight,
    fontSize: displaySizes.sm,
    fontWeight: '600',
    textAlign: 'center',
    color: BRAND_BLUE_DARK,
    opacity: 0.9
  },
  body: {
    marginTop: sharedTokens.spacing.smPlus,
    fontSize: settingsTypography.pageTitle.fontSize,
    lineHeight: 28,
    textAlign: 'center'
  }
})
