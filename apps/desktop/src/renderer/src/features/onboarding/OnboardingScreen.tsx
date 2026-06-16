import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MdArrowBackIosNew, MdArrowForwardIos } from 'react-icons/md'
import { type CompressionPromptLocale } from '@baishou/shared'
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
import styles from './OnboardingScreen.module.css'

export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const setLocale = useSettingsStore((s) => s.setLocale)
  const [currentPage, setCurrentPage] = useState(0)
  const [selectedPath, setSelectedPath] = useState('')
  const [isFinishing, setIsFinishing] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<CompressionPromptLocale | null>(null)
  const [languageConfirmed, setLanguageConfirmed] = useState(false)
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

  useEffect(() => {
    if (isPreview) return undefined

    const cleanup = window.api.onboarding.onReady(() => {
      navigate('/')
    })

    window.api.onboarding.check().then((res) => {
      setSelectedPath(res.currentPath)
    })

    return () => cleanup()
  }, [navigate, isPreview])

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

    setIsFinishing(true)
    try {
      await window.api.ensureDefaultLatteAssistant(selectedLanguage)
      await window.api.onboarding.finish()
    } catch (e) {
      console.error('完成引导失败', e)
      setIsFinishing(false)
    }
  }, [goToPage, isPreview, languageConfirmed, navigate, selectedLanguage, t])

  const handleNext = () => {
    if (isFinishing) return

    if (currentPage === ONBOARDING_PAGE.LANGUAGE) {
      if (!selectedLanguage) {
        window.alert(t('onboarding.language_required'))
        return
      }
      void applyOnboardingLanguage(selectedLanguage)
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

    const separator = path.includes('\\') ? '\\' : '/'
    const dirSuffix = 'baishou-data'
    const finalPath = path.endsWith(separator)
      ? `${path}${dirSuffix}`
      : `${path}${separator}${dirSuffix}`

    setSelectedPath(finalPath)
    if (!isPreview) {
      await window.api.onboarding.setDirectory(finalPath)
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

    if (
      !isPreview &&
      clampedPage > ONBOARDING_PAGE.LANGUAGE &&
      !languageConfirmed
    ) {
      goToPage(ONBOARDING_PAGE.LANGUAGE, { animated: false })
      return
    }

    setCurrentPage((prev) => (clampedPage !== prev ? clampedPage : prev))
  }, [goToPage, isPreview, languageConfirmed])

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
      {renderSlideBody(t('onboarding.welcome_desc'))}
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
                <MdArrowBackIosNew size={12} color="#9CA3AF" />
                <span>{t('common.back')}</span>
              </button>
            )}

            <button
              type="button"
              className={styles.nextButton}
              onClick={handleNext}
              disabled={isFinishing || nextBlockedOnLanguage}
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
              {!isLast && !isFinishing && <MdArrowForwardIos size={14} color="#FFFFFF" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
