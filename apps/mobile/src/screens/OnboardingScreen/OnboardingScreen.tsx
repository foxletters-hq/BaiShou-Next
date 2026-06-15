import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  BackHandler
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScreenSafeArea } from '@/src/components/ScreenSafeArea'
import { ONBOARDING_STORAGE_KEY } from '../../constants/storage'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { useNativeToast } from '@baishou/ui/native'
import {
  BRAND_BLUE_DARK,
  NUM_ONBOARDING_PAGES,
  ONBOARDING_PAGE,
  SLIDE_THEMES
} from './onboarding-theme'
import { OnboardingBackground } from './components/OnboardingBackground'
import { OnboardingGlowIcon } from './components/OnboardingGlowIcon'
import { OnboardingStorageSlide } from './components/OnboardingStorageSlide'
import { OnboardingLanguageSlide } from './components/OnboardingLanguageSlide'
import APP_ICON from '../../../assets/images/icon.png'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  applyOnboardingUiLanguage,
  hasPersistedOnboardingUiLanguage,
  readOnboardingUiLanguage,
  type OnboardingUiLanguage
} from '@/src/lib/onboarding-language.util'
import { ensureDefaultLatteAssistant } from '@baishou/core-mobile'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const OnboardingScreen: React.FC = () => {
  const router = useRouter()
  const { preview } = useLocalSearchParams<{ preview?: string }>()
  const isPreview = preview === '1'
  const navigation = useNavigation()
  const { t } = useTranslation()
  const toast = useNativeToast()
  const storagePermission = useStoragePermission()
  const { services, dbReady } = useBaishou()
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedLanguage, setSelectedLanguage] = useState<OnboardingUiLanguage | null>(null)
  const [languageConfirmed, setLanguageConfirmed] = useState(false)
  const scrollViewRef = useRef<ScrollView>(null)
  const floatAnim = useRef(new Animated.Value(0)).current
  const programmaticTargetRef = useRef<number | null>(null)
  const allowLeaveRef = useRef(false)

  const storageReadyToAdvance =
    !storagePermission.isAndroid ||
    (storagePermission.permissionChecked && storagePermission.granted === true)
  const nextBlockedOnStorage = currentPage === ONBOARDING_PAGE.STORAGE && !storageReadyToAdvance
  const nextBlockedOnLanguage =
    !isPreview && currentPage === ONBOARDING_PAGE.LANGUAGE && !languageConfirmed

  useEffect(() => {
    if (isPreview) return
    void readOnboardingUiLanguage().then((lang) => {
      if (!lang) return
      setSelectedLanguage(lang)
      setLanguageConfirmed(true)
    })
  }, [isPreview])

  const persistLanguageSelection = async (lang: OnboardingUiLanguage) => {
    await applyOnboardingUiLanguage(lang, {
      settingsManager: dbReady ? services?.settingsManager : undefined,
      assistantManager: dbReady ? services?.assistantManager : undefined
    })
    if (dbReady && services?.assistantManager) {
      await ensureDefaultLatteAssistant(services.assistantManager, lang)
    }
    setLanguageConfirmed(true)
  }

  const requireLanguageBeforeLeave = async (): Promise<boolean> => {
    if (isPreview || languageConfirmed) return true
    const persisted = await hasPersistedOnboardingUiLanguage()
    if (persisted) {
      setLanguageConfirmed(true)
      return true
    }
    toast.showWarning(t('onboarding.language_required'))
    goToPage(ONBOARDING_PAGE.LANGUAGE, { animated: true })
    return false
  }

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true
        })
      ])
    )
    animation.start()
    return () => animation.stop()
  }, [floatAnim])

  const finishOnboarding = async () => {
    if (!(await requireLanguageBeforeLeave())) return
    allowLeaveRef.current = true
    if (isPreview) {
      router.back()
      return
    }
    if (selectedLanguage) {
      await persistLanguageSelection(selectedLanguage)
    }
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, '1')
    router.replace('/(tabs)')
  }

  const goToPage = (page: number, options?: { animated?: boolean }) => {
    const target = Math.max(0, Math.min(page, NUM_ONBOARDING_PAGES - 1))
    programmaticTargetRef.current = target
    scrollViewRef.current?.scrollTo({
      x: target * SCREEN_WIDTH,
      animated: options?.animated ?? true
    })
  }

  const handleNext = async () => {
    if (currentPage === ONBOARDING_PAGE.LANGUAGE) {
      if (!selectedLanguage) {
        toast.showWarning(t('onboarding.language_required'))
        return
      }
      await persistLanguageSelection(selectedLanguage)
    }
    if (nextBlockedOnStorage) {
      toast.showWarning(t('storage.all_files_access_settings_hint'))
      return
    }
    const nextPage = currentPage + 1
    if (nextPage > ONBOARDING_PAGE.STORAGE && !storageReadyToAdvance) {
      toast.showWarning(t('storage.all_files_access_settings_hint'))
      return
    }
    if (currentPage < NUM_ONBOARDING_PAGES - 1) {
      goToPage(nextPage)
    } else {
      void finishOnboarding()
    }
  }

  const handlePrevious = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1)
    }
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (currentPage > 0) {
        goToPage(currentPage - 1)
      }
      return true
    })
    return () => subscription.remove()
  }, [currentPage])

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowLeaveRef.current || isPreview) return
      event.preventDefault()
    })
    return unsubscribe
  }, [navigation, isPreview])

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    const clampedPage = Math.max(0, Math.min(page, NUM_ONBOARDING_PAGES - 1))

    const pendingTarget = programmaticTargetRef.current
    if (pendingTarget !== null) {
      if (clampedPage !== pendingTarget) {
        return
      }
      programmaticTargetRef.current = null
    }

    if (clampedPage > ONBOARDING_PAGE.LANGUAGE && !languageConfirmed && !isPreview) {
      programmaticTargetRef.current = ONBOARDING_PAGE.LANGUAGE
      setCurrentPage(ONBOARDING_PAGE.LANGUAGE)
      scrollViewRef.current?.scrollTo({
        x: ONBOARDING_PAGE.LANGUAGE * SCREEN_WIDTH,
        animated: true
      })
      toast.showWarning(t('onboarding.language_required'))
      return
    }

    if (clampedPage > ONBOARDING_PAGE.STORAGE && !storageReadyToAdvance) {
      programmaticTargetRef.current = ONBOARDING_PAGE.STORAGE
      setCurrentPage(ONBOARDING_PAGE.STORAGE)
      scrollViewRef.current?.scrollTo({
        x: ONBOARDING_PAGE.STORAGE * SCREEN_WIDTH,
        animated: true
      })
      toast.showWarning(t('storage.all_files_access_settings_hint'))
      return
    }

    if (clampedPage !== currentPage) {
      setCurrentPage(clampedPage)
    }
  }

  const theme = SLIDE_THEMES[currentPage]
  const isLast = currentPage === NUM_ONBOARDING_PAGES - 1

  const welcomeScale = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04]
  })

  const renderSlideTitle = (text: string) => <Text style={styles.slideTitle}>{text}</Text>

  const renderSlideBody = (text: string) => <Text style={styles.slideBody}>{text}</Text>

  const renderLanguageSlide = () => (
    <OnboardingLanguageSlide
      selectedLanguage={selectedLanguage}
      onSelectLanguage={(lang) => {
        setSelectedLanguage(lang)
        void persistLanguageSelection(lang)
      }}
    />
  )

  const renderWelcomeSlide = () => (
    <View style={styles.slideInner}>
      <Animated.View style={[styles.welcomeIconWrap, { transform: [{ scale: welcomeScale }] }]}>
        <Image source={APP_ICON} style={styles.welcomeIcon} contentFit="cover" />
      </Animated.View>
      <Text style={styles.welcomeTitle}>{t('onboarding.welcome_title')}</Text>
      <Text style={styles.welcomeTagline}>{t('onboarding.welcome_tagline')}</Text>
      {renderSlideBody(t('onboarding.welcome_desc'))}
    </View>
  )

  const renderPhilosophySlide = () => (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.PHILOSOPHY]} />
      <View style={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.philosophy_title'))}
      <View style={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.philosophy_desc'))}
    </View>
  )

  const renderCompressionSlide = () => (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.COMPRESSION]} size={56} />
      <View style={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.compression_title'))}
      <View style={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.compression_desc'))}
    </View>
  )

  const renderStorageSlide = () => (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.STORAGE]} />
      <View style={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.storage_title'))}
      <View style={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.storage_desc'))}
      <View style={styles.slideSpacerLarge} />
      <OnboardingStorageSlide
        granted={storagePermission.granted}
        permissionChecked={storagePermission.permissionChecked}
        needsFullFileAccess={storagePermission.needsFullFileAccess}
        onRequestPermission={storagePermission.request}
      />
    </View>
  )

  const renderApiConfigSlide = () => (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.API]} />
      <View style={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.api_guide_title'))}
      <View style={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.api_guide_desc'))}
    </View>
  )

  const renderPrivacySlide = () => (
    <View style={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.PRIVACY]} />
      <View style={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.privacy_title'))}
      <View style={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.privacy_desc'))}
      <View style={styles.sloganSpacer} />
      <Text style={styles.slogan}>{t('onboarding.slogan')}</Text>
    </View>
  )

  const slides = [
    renderLanguageSlide,
    renderWelcomeSlide,
    renderPhilosophySlide,
    renderCompressionSlide,
    renderStorageSlide,
    renderApiConfigSlide,
    renderPrivacySlide
  ]

  return (
    <View style={styles.container}>
      <OnboardingBackground />

      <ScreenSafeArea preset="screen" style={styles.safeArea}>
        <View style={styles.topBar}>
          {currentPage > ONBOARDING_PAGE.LANGUAGE && currentPage < NUM_ONBOARDING_PAGES - 1 && (
            <TouchableOpacity onPress={() => void finishOnboarding()} style={styles.skipButton}>
              <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          scrollEnabled={isPreview || languageConfirmed || currentPage > ONBOARDING_PAGE.LANGUAGE}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {slides.map((renderSlide, index) => (
            <View key={index} style={styles.page}>
              <ScrollView
                contentContainerStyle={styles.pageScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {renderSlide()}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        <View style={styles.bottomControls}>
          <View style={styles.indicators}>
            {Array.from({ length: NUM_ONBOARDING_PAGES }).map((_, index) => {
              const active = currentPage === index
              return (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    {
                      width: active ? 20 : 7,
                      backgroundColor: active ? theme.iconColor : '#D1D5DB'
                    }
                  ]}
                />
              )
            })}
          </View>

          <View style={styles.navActions}>
            {currentPage > ONBOARDING_PAGE.LANGUAGE && (
              <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={12} color="#9CA3AF" />
                <Text style={styles.backText}>{t('common.back')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => void handleNext()}
              style={[
                styles.nextButton,
                {
                  backgroundColor: isLast ? theme.iconColor : BRAND_BLUE_DARK,
                  opacity: nextBlockedOnStorage || nextBlockedOnLanguage ? 0.45 : 1
                }
              ]}
              activeOpacity={nextBlockedOnStorage || nextBlockedOnLanguage ? 1 : 0.9}
            >
              <Text style={styles.nextButtonText}>
                {isLast ? t('onboarding.get_started') : t('common.next')}
              </Text>
              {!isLast && <MaterialIcons name="arrow-forward-ios" size={14} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>
      </ScreenSafeArea>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'flex-end'
  },
  skipButton: {
    paddingVertical: 4,
    paddingHorizontal: 4
  },
  skipText: {
    color: '#9CA3AF',
    fontSize: 15
  },
  scrollView: {
    flex: 1
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1
  },
  pageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%'
  },
  slideInner: {
    alignItems: 'center'
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.3,
    lineHeight: 30,
    color: '#111827'
  },
  slideBody: {
    fontSize: 16,
    lineHeight: 27,
    textAlign: 'center',
    color: '#6B7280'
  },
  welcomeIconWrap: {
    borderRadius: 32,
    shadowColor: '#9AD4EA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 8
  },
  welcomeIcon: {
    width: 140,
    height: 140,
    borderRadius: 32
  },
  welcomeTitle: {
    marginTop: 36,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    color: BRAND_BLUE_DARK
  },
  welcomeTagline: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: BRAND_BLUE_DARK,
    opacity: 0.85
  },
  slideSpacerLarge: {
    height: 36
  },
  slideSpacerMedium: {
    height: 20
  },
  sloganSpacer: {
    height: 40
  },
  slogan: {
    fontSize: 15,
    color: '#6B7280',
    letterSpacing: 2,
    textAlign: 'center'
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24
  },
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0
  },
  indicator: {
    height: 7,
    borderRadius: 4
  },
  navActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  backText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 2
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600'
  }
})
