import React, { useState, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native'
import { ScreenSafeArea } from '@/src/components/ScreenSafeArea'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNativeTheme, Input } from '@baishou/ui/native'
import { ProviderType, type AiProviderModel } from '@baishou/shared'
import { CompressionChart } from '../../components/CompressionChart'
import { ONBOARDING_STORAGE_KEY } from '../../constants/storage'
import { useBaishou } from '../../providers/BaishouProvider'
import { OnboardingStorageSlide } from './components/OnboardingStorageSlide'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface OnboardingPage {
  id: number
  titleKey: string
  subtitleKey: string
  content?: React.ReactNode
  isAiSetup?: boolean
}

const GEMINI_PROVIDER_ID = 'gemini_default'

export const OnboardingScreen: React.FC = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { services, dbReady } = useBaishou()
  const [currentPage, setCurrentPage] = useState(0)
  const [apiKey, setApiKey] = useState('')
  const scrollViewRef = useRef<ScrollView>(null)

  const saveApiKeyToProviders = async (key: string) => {
    if (!services?.settingsManager || !dbReady) return

    const existing = (await services.settingsManager.get<AiProviderModel[]>('ai_providers')) || []
    const providers: AiProviderModel[] = existing.length > 0 ? [...existing] : []

    const geminiIndex = providers.findIndex((p) => p.id === GEMINI_PROVIDER_ID)
    const geminiTemplate = providers[geminiIndex]

    const updatedGemini: AiProviderModel = {
      ...(geminiTemplate ?? {
        id: GEMINI_PROVIDER_ID,
        name: 'Google Gemini',
        type: ProviderType.Gemini,
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        defaultDialogueModel: 'gemini-2.5-flash',
        defaultNamingModel: 'gemini-2.5-flash',
        enabledModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
        isSystem: true,
        sortOrder: 2
      }),
      apiKey: key,
      isEnabled: true
    }

    if (geminiIndex >= 0) {
      providers[geminiIndex] = updatedGemini
    } else {
      providers.push(updatedGemini)
    }

    await services.settingsManager.set('ai_providers', providers)

    const globalModels =
      (await services.settingsManager.get<Record<string, string>>('global_models')) || {}
    if (!globalModels.globalDialogueProviderId) {
      globalModels.globalDialogueProviderId = GEMINI_PROVIDER_ID
      globalModels.globalDialogueModelId =
        globalModels.globalDialogueModelId ||
        updatedGemini.defaultDialogueModel ||
        'gemini-2.5-flash'
      await services.settingsManager.set('global_models', globalModels)
    }
  }

  const finishOnboarding = async (
    destination: '/(tabs)' | '/(tabs)/agent' | '/(tabs)/settings'
  ) => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    if (apiKey.trim()) {
      try {
        await saveApiKeyToProviders(apiKey.trim())
      } catch (e) {
        console.warn('[Onboarding] save api key to settings failed', e)
        await AsyncStorage.setItem('@baishou/mobile_onboarding_api_key', apiKey.trim())
      }
    }
    if (destination === '/(tabs)/settings') {
      router.replace('/(tabs)/settings')
      router.push('/settings/ai-services')
    } else if (destination === '/(tabs)/agent') {
      router.replace('/(tabs)/agent')
    } else {
      router.replace('/(tabs)')
    }
  }

  const pages: OnboardingPage[] = [
    {
      id: 1,
      titleKey: 'onboarding.welcome_title',
      subtitleKey: 'common.app_title',
      content: (
        <View style={styles.heroContainer}>
          <View style={[styles.logoBox, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.logoText}>✨</Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {t('onboarding.welcome_desc')}
          </Text>
        </View>
      )
    },
    {
      id: 2,
      titleKey: 'onboarding.compression_title',
      subtitleKey: 'onboarding.philosophy_title',
      content: (
        <View style={styles.chartContainer}>
          <Text style={[styles.chartDescription, { color: colors.textSecondary }]}>
            {t('onboarding.compression_desc')}
          </Text>
          <CompressionChart delay={300} />
        </View>
      )
    },
    {
      id: 3,
      titleKey: 'onboarding.storage_title',
      subtitleKey: 'onboarding.storage_subtitle_mobile',
      content: <OnboardingStorageSlide />
    },
    {
      id: 4,
      titleKey: 'onboarding.ai_setup_title',
      subtitleKey: 'onboarding.api_guide_title',
      isAiSetup: true,
      content: (
        <View style={styles.aiSetupContainer}>
          <Text style={[styles.chartDescription, { color: colors.textSecondary }]}>
            {t('onboarding.ai_setup_desc')}
          </Text>
          <Text style={[styles.apiKeyLabel, { color: colors.textPrimary }]}>
            {t('onboarding.api_key_label')}
          </Text>
          <Input
            value={apiKey}
            onChangeText={setApiKey}
            placeholder={t('onboarding.api_key_hint')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.primary }]}
            onPress={() => finishOnboarding('/(tabs)/settings')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
              {t('onboarding.go_to_config')}
            </Text>
          </TouchableOpacity>
        </View>
      )
    },
    {
      id: 5,
      titleKey: 'onboarding.privacy_title',
      subtitleKey: 'onboarding.privacy_desc',
      content: (
        <Text style={[styles.chartDescription, { color: colors.textSecondary }]}>
          {t('onboarding.slogan')}
        </Text>
      )
    }
  ]

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      scrollViewRef.current?.scrollTo({
        x: nextPage * SCREEN_WIDTH,
        animated: true
      })
    } else {
      finishOnboarding('/(tabs)')
    }
  }

  const handleSkip = () => {
    finishOnboarding('/(tabs)')
  }

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    if (page !== currentPage) {
      setCurrentPage(page)
    }
  }

  return (
    <ScreenSafeArea preset="screen" style={[styles.container, { backgroundColor: colors.bgApp }]}>
      {currentPage < pages.length - 1 && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            {t('onboarding.skip')}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.indicatorContainer}>
        {pages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.indicator,
              {
                backgroundColor: index === currentPage ? colors.primary : colors.bgSurfaceHighest,
                width: index === currentPage ? 24 : 8
              }
            ]}
          />
        ))}
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {pages.map((page) => (
          <View key={page.id} style={styles.page}>
            <View style={styles.pageContent}>
              <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>
                {t(page.titleKey)}
              </Text>
              <Text style={[styles.pageSubtitle, { color: colors.primary }]}>
                {page.isAiSetup ? t(page.subtitleKey) : t(page.subtitleKey)}
              </Text>
              {page.content}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.primary }]}
          onPress={handleNext}
        >
          <Text style={[styles.nextButtonText, { color: colors.textOnPrimary }]}>
            {currentPage === pages.length - 1 ? t('onboarding.get_started') : t('common.next')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenSafeArea>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500'
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 20,
    gap: 8
  },
  indicator: {
    height: 8,
    borderRadius: 4
  },
  scrollView: {
    flex: 1
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center'
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8
  },
  pageSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.85
  },
  heroContainer: {
    alignItems: 'center'
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24
  },
  logoText: {
    fontSize: 50
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24
  },
  chartContainer: {
    alignItems: 'center'
  },
  chartDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  footer: {
    padding: 24
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold'
  },
  aiSetupContainer: {
    gap: 16
  },
  apiKeyLabel: {
    fontSize: 15,
    fontWeight: '600'
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center'
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
