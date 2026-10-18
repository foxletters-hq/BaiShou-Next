import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Animated, BackHandler } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useRouter, useNavigation, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { ScreenSafeArea } from '@/src/components/ScreenSafeArea'
import { ONBOARDING_STORAGE_KEY } from '../../constants/storage'
import { useStoragePermission } from '../../hooks/useStoragePermission'
import { useNativeTheme, useNativeToast } from '@baishou/ui/native'
import {
  NUM_ONBOARDING_PAGES,
  ONBOARDING_PAGE,
  SLIDE_THEMES,
  BRAND_BLUE_DARK
} from './onboarding-theme'
import { SCREEN_WIDTH, styles } from './OnboardingScreen.styles'
import { OnboardingBackground } from './components/OnboardingBackground'
import { OnboardingGlowIcon } from './components/OnboardingGlowIcon'
import { OnboardingStorageSlide } from './components/OnboardingStorageSlide'
import { OnboardingLanguageSlide } from './components/OnboardingLanguageSlide'
import { OnboardingWelcomeSlide } from './components/OnboardingWelcomeSlide'
import { OnboardingProfileSlide } from './components/OnboardingProfileSlide'
import { useBaishou } from '@/src/providers/BaishouProvider'
import { formatLocalDate, type UserGender } from '@baishou/shared'
import {
  applyOnboardingUiLanguage,
  hasPersistedOnboardingUiLanguage,
  readOnboardingUiLanguage,
  syncOnboardingUiLanguageToVault,
  type OnboardingUiLanguage
} from '@/src/lib/onboarding-language.util'
import {
  normalizeOnboardingNickname,
  persistOnboardingNickname,
  persistOnboardingProfile,
  readOnboardingProfile,
  syncOnboardingNicknameToVault,
  syncOnboardingProfileToVault,
  type OnboardingProfileInput
} from '@/src/lib/onboarding-nickname.util'
import { isExternalStorageRequiredError } from '@/src/services/storage-permission.service'

// Re-export helpers for chrome/test compatibility
export { persistOnboardingNickname, syncOnboardingNicknameToVault }

export const OnboardingScreen: React.FC = () => {
  const router = useRouter()
  const { preview } = useLocalSearchParams<{ preview?: string }>()
  const isPreview = preview === '1'
  const navigation = useNavigation()
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { colors } = useNativeTheme()
  const storagePermission = useStoragePermission()
  const { services, dbReady, storageReady } = useBaishou()
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedLanguage, setSelectedLanguage] = useState<OnboardingUiLanguage | null>(null)
  const [languageConfirmed, setLanguageConfirmed] = useState(false)
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState(false)
  const [birthday, setBirthday] = useState(() => formatLocalDate(new Date()))
  const [gender, setGender] = useState<UserGender | null>(null)
  const [customGender, setCustomGender] = useState('')
  const scrollViewRef = useRef<ScrollView>(null)
  const floatAnim = useRef(new Animated.Value(0)).current
  const programmaticTargetRef = useRef<number | null>(null)
  const allowLeaveRef = useRef(false)

  const [isMountingStorage, setIsMountingStorage] = useState(false)

  const storageReadyToAdvance =
    !storagePermission.isAndroid ||
    (storagePermission.permissionChecked &&
      storagePermission.granted === true &&
      (storageReady || storagePermission.isStoragePending))
  const nextBlockedOnStorage =
    currentPage === ONBOARDING_PAGE.STORAGE && storagePermission.isAndroid && !storageReadyToAdvance
  const nextBlockedOnLanguage =
    !isPreview &&
    currentPage === ONBOARDING_PAGE.LANGUAGE &&
    !languageConfirmed &&
    !selectedLanguage
  const nextBlockedOnNickname =
    currentPage === ONBOARDING_PAGE.PROFILE && !normalizeOnboardingNickname(nickname)

  const ensureAndroidStorageMounted = async (): Promise<boolean> => {
    if (!storagePermission.isAndroid) return true
    if (!storagePermission.permissionChecked || storagePermission.granted !== true) {
      return false
    }
    if (storageReady) return true
    if (!dbReady) return false
    setIsMountingStorage(true)
    try {
      return await storagePermission.retryMount()
    } finally {
      setIsMountingStorage(false)
    }
  }

  useEffect(() => {
    if (isPreview) return
    void readOnboardingUiLanguage().then((lang) => {
      if (!lang) return
      setSelectedLanguage(lang)
      setLanguageConfirmed(true)
    })
    void readOnboardingProfile().then((prof) => {
      if (prof.nickname) setNickname(prof.nickname)
      if (prof.birthday) setBirthday(prof.birthday)
      if (prof.gender) setGender(prof.gender)
      if (prof.customGender) setCustomGender(prof.customGender)
    })
  }, [isPreview])

  const syncLanguageToVaultIfReady = useCallback(
    async (lang: OnboardingUiLanguage) => {
      if (!dbReady || !storageReady || !services) return
      try {
        await syncOnboardingUiLanguageToVault(lang, {
          settingsManager: services.settingsManager,
          assistantManager: services.assistantManager
        })
      } catch (e) {
        if (!isExternalStorageRequiredError(e)) {
          console.warn('[Onboarding] vault language sync failed:', e)
        }
      }
    },
    [dbReady, storageReady, services]
  )

  const persistLanguageSelection = async (lang: OnboardingUiLanguage) => {
    await applyOnboardingUiLanguage(lang)
    setLanguageConfirmed(true)
    await syncLanguageToVaultIfReady(lang)
  }

  const syncProfileToVaultIfReady = useCallback(
    async (prof: OnboardingProfileInput) => {
      if (!dbReady || !storageReady || !services) return
      try {
        await syncOnboardingProfileToVault(prof, services.settingsManager)
      } catch (e) {
        if (!isExternalStorageRequiredError(e)) {
          console.warn('[Onboarding] vault profile sync failed:', e)
        }
      }
    },
    [dbReady, storageReady, services]
  )

  const persistProfileSelection = async (
    prof: OnboardingProfileInput
  ): Promise<OnboardingProfileInput | null> => {
    const saved = await persistOnboardingProfile(prof)
    if (!saved) return null
    setNickname(saved.nickname)
    setBirthday(saved.birthday ?? '')
    setGender(saved.gender)
    setCustomGender(saved.customGender ?? '')
    await syncProfileToVaultIfReady(saved)
    return saved
  }

  useEffect(() => {
    if (!selectedLanguage || !languageConfirmed) return
    void syncLanguageToVaultIfReady(selectedLanguage)
  }, [selectedLanguage, languageConfirmed, syncLanguageToVaultIfReady])

  useEffect(() => {
    const name = normalizeOnboardingNickname(nickname)
    if (!name) return
    void syncProfileToVaultIfReady({ nickname: name, birthday, gender, customGender })
  }, [nickname, birthday, gender, customGender, syncProfileToVaultIfReady])

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

  const requireNicknameBeforeLeave = async (): Promise<boolean> => {
    const persisted =
      normalizeOnboardingNickname(nickname) ?? (await readOnboardingProfile()).nickname
    if (persisted) {
      setNickname(persisted)
      setNicknameError(false)
      return true
    }
    setNicknameError(true)
    toast.showWarning(t('onboarding.nickname_required', '请告诉伙伴你的名字吧~'))
    goToPage(ONBOARDING_PAGE.PROFILE, { animated: true })
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
    if (!(await requireNicknameBeforeLeave())) return
    if (storagePermission.isAndroid && storagePermission.granted === true && !storageReady) {
      const mounted = await ensureAndroidStorageMounted()
      if (!mounted) {
        toast.showWarning(t('storage.external_access_error'))
        return
      }
    }
    allowLeaveRef.current = true
    const name = normalizeOnboardingNickname(nickname)
    if (name) {
      await persistProfileSelection({ nickname: name, birthday, gender, customGender })
    }
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

    if (currentPage === ONBOARDING_PAGE.PROFILE) {
      const saved = await persistProfileSelection({ nickname, birthday, gender, customGender })
      if (!saved?.nickname) {
        setNicknameError(true)
        toast.showWarning(t('onboarding.nickname_required', '请告诉伙伴你的名字吧~'))
        return
      }
      setNicknameError(false)
    }

    if (storagePermission.isAndroid && currentPage === ONBOARDING_PAGE.STORAGE) {
      if (!storagePermission.permissionChecked) {
        return
      }
      if (storagePermission.granted !== true) {
        toast.showWarning(t('storage.all_files_access_settings_hint'))
        return
      }
      if (!storageReady) {
        const mounted = await ensureAndroidStorageMounted()
        if (!mounted) {
          toast.showWarning(t('storage.external_access_error'))
          return
        }
      }
    }

    const nextPage = currentPage + 1
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

    if (clampedPage > ONBOARDING_PAGE.PROFILE && !normalizeOnboardingNickname(nickname)) {
      setNicknameError(true)
      programmaticTargetRef.current = ONBOARDING_PAGE.PROFILE
      setCurrentPage(ONBOARDING_PAGE.PROFILE)
      scrollViewRef.current?.scrollTo({
        x: ONBOARDING_PAGE.PROFILE * SCREEN_WIDTH,
        animated: true
      })
      toast.showWarning(t('onboarding.nickname_required', '请告诉伙伴你的名字吧~'))
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

  const renderSlideTitle = (text: string) => (
    <Text style={[styles.slideTitle, { color: colors.textPrimary }]}>{text}</Text>
  )

  const renderSlideBody = (text: string) => (
    <Text style={[styles.slideBody, { color: colors.textSecondary }]}>{text}</Text>
  )

  const renderLanguageSlide = () => (
    <OnboardingLanguageSlide
      selectedLanguage={selectedLanguage}
      onSelectLanguage={(lang) => {
        setSelectedLanguage(lang)
        void persistLanguageSelection(lang).catch(() => {
          toast.showError(t('onboarding.language_save_error', '无法保存语言设置，请重试'))
        })
      }}
    />
  )

  const renderWelcomeSlide = () => <OnboardingWelcomeSlide welcomeScale={welcomeScale} />

  const renderProfileSlide = () => (
    <OnboardingProfileSlide
      nickname={nickname}
      onChangeNickname={(val) => {
        setNickname(val)
        if (nicknameError && normalizeOnboardingNickname(val)) {
          setNicknameError(false)
        }
      }}
      nicknameError={nicknameError}
      birthday={birthday}
      onChangeBirthday={setBirthday}
      gender={gender}
      onChangeGender={setGender}
      customGender={customGender}
      onChangeCustomGender={setCustomGender}
    />
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
        isStoragePending={storagePermission.isStoragePending || isMountingStorage}
        mountFailed={storagePermission.mountFailed}
        onRequestPermission={storagePermission.request}
        onRetryMount={() => void storagePermission.retryMount()}
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
      <Text style={[styles.slogan, { color: colors.textSecondary }]}>{t('onboarding.slogan')}</Text>
    </View>
  )

  const slides = [
    renderLanguageSlide,
    renderWelcomeSlide,
    renderProfileSlide,
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
                      backgroundColor: active ? theme.iconColor : colors.borderMuted
                    }
                  ]}
                />
              )
            })}
          </View>

          <View style={styles.navActions}>
            {currentPage > ONBOARDING_PAGE.LANGUAGE && (
              <TouchableOpacity onPress={handlePrevious} style={styles.backButton}>
                <ChevronLeft size={12} color={colors.textTertiary} strokeWidth={2} />
                <Text style={[styles.backText, { color: colors.textSecondary }]}>
                  {t('common.back')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => void handleNext()}
              style={[
                styles.nextButton,
                {
                  backgroundColor: isLast ? theme.iconColor : BRAND_BLUE_DARK,
                  opacity:
                    nextBlockedOnLanguage || nextBlockedOnNickname || isMountingStorage
                      ? 0.45
                      : nextBlockedOnStorage && storagePermission.granted !== true
                        ? 0.45
                        : 1
                }
              ]}
              activeOpacity={
                nextBlockedOnLanguage || nextBlockedOnNickname || isMountingStorage ? 1 : 0.9
              }
              disabled={isMountingStorage}
            >
              <Text style={[styles.nextButtonText, { color: colors.textOnPrimary }]}>
                {isMountingStorage
                  ? t('storage.mounting')
                  : isLast
                    ? t('onboarding.get_started')
                    : t('common.next')}
              </Text>
              {!isLast && !isMountingStorage && (
                <ChevronRight size={14} color={colors.textOnPrimary} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScreenSafeArea>
    </View>
  )
}
