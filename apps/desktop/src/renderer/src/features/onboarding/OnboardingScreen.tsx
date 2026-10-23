import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  APP_UI_LANGUAGE_ORDER,
  formatLocalDate,
  normalizeGraphAwakenNickname,
  USER_GENDERS,
  type CompressionPromptLocale,
  type UserGender
} from '@baishou/shared'
import { Input } from '@baishou/ui'
import { useSettingsStore } from '@baishou/store'
import icon from '../../../../../resources/icon.png?asset'
import {
  BRAND_BLUE_DARK,
  NUM_ONBOARDING_PAGES,
  ONBOARDING_PAGE,
  SLIDE_THEMES
} from './onboarding-theme'
import { OnboardingBackground } from './components/OnboardingBackground'
import { OnboardingGlowIcon } from './components/OnboardingGlowIcon'
import { OnboardingStorageSlide } from './components/OnboardingStorageSlide'
import { OnboardingLanguagePage } from './OnboardingLanguagePage'
import { GraphAwakenBirthdayField } from '../graph/GraphAwakenBirthdayField'
import styles from './OnboardingScreen.module.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const setLocale = useSettingsStore((s) => s.setLocale)
  const persistedLocale = useSettingsStore((s) => s.locale)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedPath, setSelectedPath] = useState('')
  const [isFinishing, setIsFinishing] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<CompressionPromptLocale | null>(null)
  const [languageConfirmed, setLanguageConfirmed] = useState(false)
  const [nickname, setNickname] = useState('')
  const [nicknameError, setNicknameError] = useState(false)
  const [birthday, setBirthday] = useState(() => formatLocalDate(new Date()))
  const [gender, setGender] = useState<UserGender | null>(null)
  const [customGender, setCustomGender] = useState('')
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const programmaticTargetRef = useRef<number | null>(null)

  const applyOnboardingLanguage = useCallback(
    async (lang: CompressionPromptLocale) => {
      setSelectedLanguage(lang)
      setLanguageConfirmed(true)
      setLocale(lang)
      try {
        const features = (await window.api.settings.getFeatures()) || {}
        await window.api.settings.setFeatures({ ...features, language: lang })
        await window.api.ensureDefaultLatteAssistant(lang)
      } catch (e) {
        console.warn('Failed to persist onboarding language', e)
      }
    },
    [setLocale]
  )

  const persistOnboardingProfile = useCallback(async () => {
    const name = normalizeGraphAwakenNickname(nickname)
    if (!name) return null
    try {
      const current = (await window.api.profile?.getProfile?.()) || {}
      await window.api.profile?.saveProfile?.({
        ...current,
        nickname: name,
        birthday: birthday.trim() || null,
        gender: gender ?? null,
        customGender: gender === 'other' && customGender.trim() ? customGender.trim() : null
      })
      await window.api.settings?.setGraphSelfNameConfigured?.(true)
    } catch (e) {
      console.warn('Failed to persist onboarding profile', e)
    }
    return name
  }, [birthday, customGender, gender, nickname])

  useEffect(() => {
    if (isPreview) return undefined

    const cleanup = window.api.onboarding.onReady(() => {
      navigate('/')
    })

    window.api.onboarding.check().then((res) => {
      setSelectedPath(res.currentPath)
    })

    void window.api.profile
      ?.getProfile?.()
      .then((prof) => {
        if (!prof) return
        const normalized = normalizeGraphAwakenNickname(prof.nickname)
        if (normalized) setNickname(normalized)
        if (prof.birthday) setBirthday(String(prof.birthday).trim())
        if (prof.gender) setGender(prof.gender as UserGender)
        if (prof.customGender) setCustomGender(String(prof.customGender).trim())
      })
      .catch(() => {
        /* profile may not be ready yet */
      })

    return () => cleanup()
  }, [navigate, isPreview])

  // 恢复已持久化的语言，避免每次进入引导都需重新点选
  useEffect(() => {
    if (isPreview) return

    const restoreLanguage = async () => {
      let lang: CompressionPromptLocale | null = null

      if (
        persistedLocale &&
        persistedLocale !== 'system' &&
        APP_UI_LANGUAGE_ORDER.includes(persistedLocale as CompressionPromptLocale)
      ) {
        lang = persistedLocale as CompressionPromptLocale
      } else {
        try {
          const features = (await window.api.settings.getFeatures()) || {}
          const saved = features.language
          if (
            typeof saved === 'string' &&
            APP_UI_LANGUAGE_ORDER.includes(saved as CompressionPromptLocale)
          ) {
            lang = saved as CompressionPromptLocale
          }
        } catch {
          /* settings may be unavailable before bootstrap */
        }
      }

      if (lang) {
        setSelectedLanguage(lang)
        setLanguageConfirmed(true)
        setLocale(lang)
      }
    }

    void restoreLanguage()
  }, [isPreview, persistedLocale, setLocale])

  useEffect(() => {
    if (!isPreview) return
    window.api.onboarding.check().then((res) => {
      setSelectedPath(res.currentPath)
    })
  }, [isPreview])

  const goToPage = useCallback((page: number, options?: { animated?: boolean }) => {
    const target = Math.max(0, Math.min(page, NUM_ONBOARDING_PAGES - 1))
    programmaticTargetRef.current = target
    const viewport = scrollViewportRef.current
    if (!viewport) return

    viewport.scrollTo({
      left: target * viewport.clientWidth,
      behavior: options?.animated === false ? 'auto' : 'smooth'
    })
  }, [])

  const finishOnboarding = useCallback(async () => {
    if (isPreview) {
      navigate('/')
      return
    }

    if (!languageConfirmed || !selectedLanguage) {
      window.alert(t('onboarding.language_required'))
      goToPage(ONBOARDING_PAGE.LANGUAGE)
      return
    }

    if (!normalizeGraphAwakenNickname(nickname)) {
      setNicknameError(true)
      window.alert(t('onboarding.nickname_required', '请告诉伙伴你的名字吧~'))
      goToPage(ONBOARDING_PAGE.PROFILE)
      return
    }

    setIsFinishing(true)
    try {
      if (selectedPath.trim()) {
        await window.api.onboarding.setDirectory(selectedPath.trim())
      }
      await persistOnboardingProfile()
      await window.api.ensureDefaultLatteAssistant(selectedLanguage)
      await window.api.onboarding.finish()
    } catch (e) {
      console.error('完成引导失败', e)
      setIsFinishing(false)
    }
  }, [
    goToPage,
    isPreview,
    languageConfirmed,
    navigate,
    nickname,
    persistOnboardingProfile,
    selectedLanguage,
    selectedPath,
    t
  ])

  const handleNext = () => {
    if (isFinishing) return

    if (currentPage === ONBOARDING_PAGE.LANGUAGE) {
      if (!selectedLanguage) {
        window.alert(t('onboarding.language_required'))
        return
      }
      void applyOnboardingLanguage(selectedLanguage)
    }

    if (currentPage === ONBOARDING_PAGE.PROFILE) {
      if (!normalizeGraphAwakenNickname(nickname)) {
        setNicknameError(true)
        window.alert(t('onboarding.nickname_required', '请告诉伙伴你的名字吧~'))
        return
      }
      void persistOnboardingProfile()
    }

    if (currentPage < NUM_ONBOARDING_PAGES - 1) {
      goToPage(currentPage + 1)
    } else {
      void finishOnboarding()
    }
  }

  const handlePrevious = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1)
    }
  }

  const handlePickDirectory = async () => {
    const path = await window.api.onboarding.pickDirectory()
    if (!path) return

    setSelectedPath(path)
    if (!isPreview) {
      await window.api.onboarding.setDirectory(path)
    }
  }

  const handleScroll = useCallback(() => {
    const viewport = scrollViewportRef.current
    if (!viewport || viewport.clientWidth === 0) return

    const page = Math.round(viewport.scrollLeft / viewport.clientWidth)
    const clampedPage = Math.max(0, Math.min(page, NUM_ONBOARDING_PAGES - 1))

    const pendingTarget = programmaticTargetRef.current
    if (pendingTarget !== null) {
      if (clampedPage !== pendingTarget) return
      programmaticTargetRef.current = null
    }

    if (!isPreview && clampedPage > ONBOARDING_PAGE.LANGUAGE && !languageConfirmed) {
      goToPage(ONBOARDING_PAGE.LANGUAGE, { animated: false })
      return
    }

    if (clampedPage > ONBOARDING_PAGE.PROFILE && !normalizeGraphAwakenNickname(nickname)) {
      setNicknameError(true)
      goToPage(ONBOARDING_PAGE.PROFILE, { animated: false })
      return
    }

    setCurrentPage((prev) => (clampedPage !== prev ? clampedPage : prev))
  }, [goToPage, isPreview, languageConfirmed, nickname])

  useEffect(() => {
    const viewport = scrollViewportRef.current
    if (!viewport) return

    const onResize = () => {
      goToPage(currentPage, { animated: false })
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', onResize)
    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [currentPage, goToPage, handleScroll])

  const theme = SLIDE_THEMES[currentPage]
  const isLast = currentPage === NUM_ONBOARDING_PAGES - 1
  const nextBlockedOnLanguage =
    !isPreview && currentPage === ONBOARDING_PAGE.LANGUAGE && !languageConfirmed
  const nextBlockedOnNickname =
    currentPage === ONBOARDING_PAGE.PROFILE && !normalizeGraphAwakenNickname(nickname)

  const renderSlideTitle = (text: string) => <h2 className={styles.slideTitle}>{text}</h2>
  const renderSlideBody = (text: string) => <p className={styles.slideBody}>{text}</p>

  const renderLanguageSlide = () => (
    <OnboardingLanguagePage
      selectedLanguage={selectedLanguage}
      onSelectLanguage={(lang) => {
        void applyOnboardingLanguage(lang)
      }}
    />
  )

  const renderWelcomeSlide = () => (
    <div className={styles.slideInner}>
      <div className={styles.welcomeIconWrap}>
        <img src={icon} alt={t('common.app_title', 'BaiShou')} className={styles.welcomeIcon} />
      </div>
      <h1 className={styles.welcomeTitle}>{t('onboarding.welcome_title')}</h1>
      <p className={styles.welcomeTagline}>{t('onboarding.welcome_tagline')}</p>
      <p className={styles.welcomeDesc}>{t('onboarding.welcome_desc')}</p>
    </div>
  )

  const renderProfileSlide = () => (
    <div className={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.PROFILE]} />
      <div className={styles.slideSpacerMedium} />
      {renderSlideTitle(t('onboarding.profile_title', '让伙伴认识你'))}
      <div className={styles.profileForm}>
        <div className={styles.profileField}>
          <div className={styles.labelRow}>
            <span className={styles.profileLabel}>
              {t('onboarding.nickname_label', '你的名字')}
            </span>
            <span className={styles.requiredMark}>*</span>
          </div>
          <Input
            value={nickname}
            onChange={(e) => {
              setNickname(e.target.value)
              if (nicknameError && normalizeGraphAwakenNickname(e.target.value)) {
                setNicknameError(false)
              }
            }}
            placeholder={t('onboarding.nickname_placeholder', '怎么称呼你？')}
            error={
              nicknameError ? t('onboarding.nickname_required', '请告诉伙伴你的名字吧~') : undefined
            }
          />
        </div>

        <div className={styles.profileField}>
          <span className={styles.profileLabel}>{t('onboarding.birthday_label', '你的生日')}</span>
          <GraphAwakenBirthdayField
            value={birthday}
            onChange={setBirthday}
            placeholder={t('onboarding.birthday_placeholder', '选择你的生日（选填）')}
          />
        </div>

        <div className={styles.profileField}>
          <span className={styles.profileLabel}>{t('onboarding.gender_label', '你的性别')}</span>
          <div className={styles.genderRow} role="radiogroup">
            {USER_GENDERS.map((g) => {
              const active = gender === g
              return (
                <button
                  key={g}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? styles.genderChipActive : styles.genderChip}
                  onClick={() => setGender(active ? null : g)}
                >
                  {t(
                    `graph.awaken_gender_${g}`,
                    g === 'male'
                      ? '男'
                      : g === 'female'
                        ? '女'
                        : g === 'other'
                          ? '自定义'
                          : '暂不设置'
                  )}
                </button>
              )
            })}
          </div>
          {gender === 'other' ? (
            <Input
              value={customGender}
              onChange={(e) => setCustomGender(e.target.value)}
              placeholder={t('profile.custom_gender_placeholder', '输入自定义性别')}
            />
          ) : null}
        </div>
      </div>
    </div>
  )

  const renderPhilosophySlide = () => (
    <div className={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.PHILOSOPHY]} />
      <div className={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.philosophy_title'))}
      <div className={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.philosophy_desc'))}
    </div>
  )

  const renderCompressionSlide = () => (
    <div className={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.COMPRESSION]} size={56} />
      <div className={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.compression_title'))}
      <div className={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.compression_desc'))}
    </div>
  )

  const renderStorageSlide = () => (
    <div className={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.STORAGE]} />
      <div className={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.storage_title'))}
      <div className={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.storage_desc'))}
      <div className={styles.slideSpacerLarge} />
      <OnboardingStorageSlide rootPath={selectedPath} onChangeStorage={handlePickDirectory} />
    </div>
  )

  const renderApiConfigSlide = () => (
    <div className={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.API]} />
      <div className={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.api_guide_title'))}
      <div className={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.api_guide_desc'))}
    </div>
  )

  const renderPrivacySlide = () => (
    <div className={styles.slideInner}>
      <OnboardingGlowIcon theme={SLIDE_THEMES[ONBOARDING_PAGE.PRIVACY]} />
      <div className={styles.slideSpacerLarge} />
      {renderSlideTitle(t('onboarding.privacy_title'))}
      <div className={styles.slideSpacerMedium} />
      {renderSlideBody(t('onboarding.privacy_desc'))}
      <div className={styles.sloganSpacer} />
      <p className={styles.slogan}>{t('onboarding.slogan')}</p>
    </div>
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
    <div className={styles.screen}>
      <OnboardingBackground />

      <div className={styles.safeArea}>
        <div ref={scrollViewportRef} className={styles.scrollViewport}>
          {slides.map((renderSlide, index) => (
            <div key={index} className={styles.page}>
              <div className={styles.pageScrollContent}>{renderSlide()}</div>
            </div>
          ))}
        </div>

        <div className={styles.bottomControls}>
          <div className={styles.indicators}>
            {Array.from({ length: NUM_ONBOARDING_PAGES }).map((_, index) => {
              const active = currentPage === index
              return (
                <div
                  key={index}
                  className={styles.indicator}
                  style={{
                    width: active ? 20 : 7,
                    backgroundColor: active ? theme.iconColor : '#D1D5DB'
                  }}
                />
              )
            })}
          </div>

          <div className={styles.navActions}>
            {currentPage > 0 && (
              <button type="button" className={styles.backButton} onClick={handlePrevious}>
                <ChevronLeft size={12} color="#9CA3AF" />
                <span>{t('common.back')}</span>
              </button>
            )}

            <button
              type="button"
              className={styles.nextButton}
              onClick={handleNext}
              disabled={isFinishing || nextBlockedOnLanguage || nextBlockedOnNickname}
              style={{
                backgroundColor: isLast ? theme.iconColor : BRAND_BLUE_DARK
              }}
            >
              <span>
                {isFinishing
                  ? t('common.loading')
                  : isLast
                    ? t('onboarding.get_started')
                    : t('common.next')}
              </span>
              {!isLast && !isFinishing && <ChevronRight size={14} color="#FFFFFF" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
