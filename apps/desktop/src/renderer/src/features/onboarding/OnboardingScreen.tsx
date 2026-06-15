import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  Layers,
  FolderOpen,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Cpu,
  Languages
} from 'lucide-react'
import { type CompressionPromptLocale } from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'
import icon from '../../../../../resources/icon.png?asset'
import styles from './OnboardingScreen.module.css'
import { OnboardingLanguagePage } from './OnboardingLanguagePage'

interface OnboardingPageConfig {
  id: string
  icon?: React.ReactNode
  title?: string
  tagline?: string
  desc?: string
  color: string
  isLanguage?: boolean
  isStorage?: boolean
  isLast?: boolean
}

export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'
  const setLocale = useSettingsStore((s) => s.setLocale)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [isFinishing, setIsFinishing] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState<CompressionPromptLocale | null>(null)
  const [languageConfirmed, setLanguageConfirmed] = useState(false)

  const applyOnboardingLanguage = async (lang: CompressionPromptLocale) => {
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
  }

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

  const ONBOARDING_PAGES: OnboardingPageConfig[] = useMemo(
    () => [
      {
        id: 'language',
        icon: <Languages size={48} />,
        color: '#5BA8CD',
        isLanguage: true
      },
      {
        id: 'welcome',
        icon: <img src={icon} alt="BaiShou" className={styles.appLogo} />,
        title: t('onboarding.welcome_title'),
        tagline: t('onboarding.welcome_tagline'),
        desc: t('onboarding.welcome_desc'),
        color: '#9AD4EA'
      },
      {
        id: 'philosophy',
        icon: <BookOpen size={48} />,
        title: t('onboarding.philosophy_title'),
        desc: t('onboarding.philosophy_desc'),
        color: '#9B8DC4'
      },
      {
        id: 'compression',
        icon: <Layers size={48} />,
        title: t('onboarding.compression_title'),
        desc: t('onboarding.compression_desc'),
        color: '#3D8FD9'
      },
      {
        id: 'storage',
        icon: <FolderOpen size={48} />,
        title: t('onboarding.storage_title'),
        desc: t('onboarding.storage_desc'),
        isStorage: true,
        color: '#FFB74D'
      },
      {
        id: 'api-guide',
        icon: <Cpu size={48} />,
        title: t('onboarding.api_guide_title'),
        desc: t('onboarding.api_guide_desc'),
        color: '#90CAF9'
      },
      {
        id: 'privacy',
        icon: <ShieldCheck size={48} />,
        title: t('onboarding.privacy_title'),
        desc: t('onboarding.privacy_desc'),
        isLast: true,
        color: '#81C784'
      }
    ],
    [t]
  )

  const handleNext = async () => {
    if (currentIndex === 0) {
      if (!selectedLanguage) {
        window.alert(t('onboarding.language_required'))
        return
      }
      await applyOnboardingLanguage(selectedLanguage)
    }
    if (currentIndex < ONBOARDING_PAGES.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handlePickDirectory = async () => {
    const path = await window.api.onboarding.pickDirectory()
    if (path) {
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
  }

  const handleFinish = async () => {
    if (isPreview) {
      navigate('/')
      return
    }

    if (!languageConfirmed || !selectedLanguage) {
      window.alert(t('onboarding.language_required'))
      setCurrentIndex(0)
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
  }

  const currentPage = ONBOARDING_PAGES[currentIndex]
  const nextBlockedOnLanguage = !isPreview && currentIndex === 0 && !languageConfirmed

  return (
    <div
      className={styles.screen}
      style={{ '--theme-color': currentPage.color } as React.CSSProperties}
    >
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={styles.contentBox}>
        <div className={styles.slideContainer}>
          {ONBOARDING_PAGES.map((page, index) => (
            <div
              key={page.id}
              className={`${styles.page} ${index === currentIndex ? styles.active : ''} ${index < currentIndex ? styles.prev : ''}`}
            >
              {page.isLanguage ? (
                <OnboardingLanguagePage
                  selectedLanguage={selectedLanguage}
                  onSelectLanguage={(lang) => {
                    void applyOnboardingLanguage(lang)
                  }}
                />
              ) : (
                <>
                  {page.icon && <div className={styles.iconWrapper}>{page.icon}</div>}
                  <h1 className={page.id === 'welcome' ? styles.titleWelcome : styles.title}>
                    {page.title}
                  </h1>
                  {page.tagline ? <p className={styles.tagline}>{page.tagline}</p> : null}
                  <p className={styles.subtitle}>{page.desc}</p>
                </>
              )}

              {page.isStorage && (
                <div className={styles.storageBox}>
                  <div className={styles.pathLabel}>{t('onboarding.current_storage')}</div>
                  <div className={styles.pathText}>{selectedPath}</div>
                  <button className={styles.pickBtn} onClick={handlePickDirectory}>
                    <FolderOpen size={16} />
                    {t('onboarding.change_storage')}
                  </button>
                </div>
              )}

              {page.isLast && <div className={styles.slogan}>{t('onboarding.slogan')}</div>}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <div className={styles.indicators}>
            {ONBOARDING_PAGES.map((_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                onClick={() => {
                  if (i === 0 || languageConfirmed) {
                    if (i <= currentIndex) setCurrentIndex(i)
                  }
                }}
              />
            ))}
          </div>

          <div className={styles.btnGroup}>
            {currentIndex > 0 && (
              <button className={styles.btnBack} onClick={handleBack}>
                <ChevronLeft size={16} />
                {t('common.back')}
              </button>
            )}

            {currentPage.isLast ? (
              <button className={styles.btnPrimary} onClick={handleFinish} disabled={isFinishing}>
                {isFinishing ? t('common.loading') : t('onboarding.get_started')}
                {!isFinishing && <ArrowRight size={18} />}
              </button>
            ) : (
              <button
                className={styles.btnPrimary}
                onClick={() => void handleNext()}
                disabled={nextBlockedOnLanguage}
              >
                {t('common.next')}
                <ChevronRight size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
