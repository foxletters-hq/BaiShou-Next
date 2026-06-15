import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import {
  ONBOARDING_LANGUAGE_OPTIONS,
  type OnboardingUiLanguage
} from '@/src/lib/onboarding-language.util'
import { BRAND_BLUE_DARK } from '../onboarding-theme'

type OnboardingLanguageSlideProps = {
  selectedLanguage: OnboardingUiLanguage | null
  onSelectLanguage: (lang: OnboardingUiLanguage) => void
}

export const OnboardingLanguageSlide: React.FC<OnboardingLanguageSlideProps> = ({
  selectedLanguage,
  onSelectLanguage
}) => {
  const { t } = useTranslation()

  return (
    <View style={styles.slideInner}>
      <View style={styles.iconWrap}>
        <MaterialIcons name="language" size={56} color={BRAND_BLUE_DARK} />
      </View>
      <Text style={styles.title}>{t('onboarding.language_title')}</Text>
      <Text style={styles.body}>{t('onboarding.language_desc')}</Text>
      <View style={styles.langList}>
        {ONBOARDING_LANGUAGE_OPTIONS.map((option) => {
          const active = selectedLanguage === option.id
          return (
            <TouchableOpacity
              key={option.id}
              activeOpacity={0.85}
              style={[styles.langChip, active && styles.langChipActive]}
              onPress={() => onSelectLanguage(option.id)}
            >
              <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                {option.label}
              </Text>
              {active ? <MaterialIcons name="check" size={18} color={BRAND_BLUE_DARK} /> : null}
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
    marginTop: 28,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827'
  },
  body: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    color: '#6B7280'
  },
  langList: {
    marginTop: 28,
    width: '100%',
    gap: 12
  },
  langChip: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.72)'
  },
  langChipActive: {
    borderColor: BRAND_BLUE_DARK,
    backgroundColor: 'rgba(154, 212, 234, 0.14)'
  },
  langChipText: {
    fontSize: 16,
    color: '#374151'
  },
  langChipTextActive: {
    color: BRAND_BLUE_DARK,
    fontWeight: '700'
  }
})
