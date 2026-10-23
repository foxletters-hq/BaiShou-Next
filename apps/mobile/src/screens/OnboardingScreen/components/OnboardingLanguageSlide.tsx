import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Languages, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import {
  ONBOARDING_LANGUAGE_OPTIONS,
  type OnboardingUiLanguage
} from '@/src/lib/onboarding-language.util'
import { BRAND_BLUE_DARK } from '../onboarding-theme'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type OnboardingLanguageSlideProps = {
  selectedLanguage: OnboardingUiLanguage | null
  onSelectLanguage: (lang: OnboardingUiLanguage) => void
}

export const OnboardingLanguageSlide: React.FC<OnboardingLanguageSlideProps> = ({
  selectedLanguage,
  onSelectLanguage
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={styles.slideInner}>
      <View style={styles.iconWrap}>
        <Languages size={56} color={BRAND_BLUE_DARK} strokeWidth={2} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {t('onboarding.language_title')}
      </Text>
      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {t('onboarding.language_desc')}
      </Text>
      <View style={styles.langList}>
        {ONBOARDING_LANGUAGE_OPTIONS.map((option) => {
          const active = selectedLanguage === option.id
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.85}
              style={[
                styles.langChip,
                {
                  borderColor: colors.borderMuted,
                  backgroundColor: colors.bgGlassSurface
                },
                active && {
                  borderColor: BRAND_BLUE_DARK,
                  backgroundColor: 'rgba(154, 212, 234, 0.14)'
                }
              ]}
              onPress={() => onSelectLanguage(option.id)}
            >
              <Text
                style={[
                  styles.langChipText,
                  { color: colors.textPrimary },
                  active && styles.langChipTextActive
                ]}
              >
                {option.label}
              </Text>
              {active ? <Check size={18} color={BRAND_BLUE_DARK} strokeWidth={2} /> : null}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  slideInner: {
    alignItems: 'center',
    width: '100%'
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(154, 212, 234, 0.18)'
  },
  title: {
    marginTop: sharedTokens.spacing.lg,
    fontSize: mobileTypography.display.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  body: {
    marginTop: sharedTokens.spacing.mdTight,
    fontSize: mobileTypography.primary.fontSize,
    lineHeight: 26,
    textAlign: 'center'
  },
  langList: {
    marginTop: sharedTokens.spacing.lg,
    width: '100%',
    gap: sharedTokens.spacing.mdTight
  },
  langChip: {
    minHeight: 52,
    borderRadius: sharedTokens.radius.md,
    borderWidth: 1,
    paddingHorizontal: sharedTokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  langChipText: {
    fontSize: mobileTypography.primary.fontSize
  },
  langChipTextActive: {
    color: BRAND_BLUE_DARK,
    fontWeight: '600'
  }
})
