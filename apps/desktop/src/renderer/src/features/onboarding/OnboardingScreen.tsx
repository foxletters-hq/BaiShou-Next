import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Import
} from 'lucide-react'
import icon from '../../../../../resources/icon.png?asset'
import styles from './OnboardingScreen.module.css'

interface OnboardingPageConfig {
  id: string
  icon?: React.ReactNode
  title: string
  tagline?: string
  desc: string
  color: string
  isStorage?: boolean
  isImport?: boolean
  isLast?: boolean
}

export const OnboardingScreen: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [isFinishing, setIsFinishing] = useState(false)

  useEffect(() => {
    const cleanup = window.api.onboarding.onReady(() => {
      navigate('/')
    })

    window.api.onboarding.check().then((res) => {
      setSelectedPath(res.currentPath)
    })

    return () => cleanup()
  }, [navigate])

  const ONBOARDING_PAGES: OnboardingPageConfig[] = [
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
      id: 'import',
      icon: <Import size={48} />,
      title: t('onboarding.import_title'),
      desc: t('onboarding.import_desc'),
      isImport: true,
      color: '#4DB6AC'
    },
    {
      id: 'privacy',
      icon: <ShieldCheck size={48} />,
      title: t('onboarding.privacy_title'),
      desc: t('onboarding.privacy_desc'),
      isLast: true,
      color: '#81C784'
    }
  ]

  const handleNext = () => {
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
      await window.api.onboarding.setDirectory(finalPath)
    }
  }

  const handleFinish = async () => {
    setIsFinishing(true)
    try {
      await window.api.onboarding.finish()
    } catch (e) {
      console.error('完成引导失败', e)
      setIsFinishing(false)
    }
  }

  const currentPage = ONBOARDING_PAGES[currentIndex]

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
              {page.icon && <div className={styles.iconWrapper}>{page.icon}</div>}
              <h1 className={page.id === 'welcome' ? styles.titleWelcome : styles.title}>
                {page.title}
              </h1>
              {page.tagline ? <p className={styles.tagline}>{page.tagline}</p> : null}
              <p className={styles.subtitle}>{page.desc}</p>

              {page.isStorage && (
                <div className={styles.storageBox}>
                  <div className={styles.pathLabel}>
                    {t('onboarding.current_storage')}
                  </div>
                  <div className={styles.pathText}>{selectedPath}</div>
                  <button className={styles.pickBtn} onClick={handlePickDirectory}>
                    <FolderOpen size={16} />
                    {t('onboarding.change_storage')}
                  </button>
                </div>
              )}

              {page.isImport && (
                <div className={styles.storageBox}>
                  <div className={styles.pathLabel}>{t('onboarding.import_hint')}</div>
                  <div className={styles.hintText}>{t('onboarding.import_steps')}</div>
                </div>
              )}

              {page.isLast && (
                <div className={styles.slogan}>{t('onboarding.slogan')}</div>
              )}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <div className={styles.indicators}>
            {ONBOARDING_PAGES.map((_, i) => (
              <div
                key={i}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                onClick={() => setCurrentIndex(i)}
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
              <button className={styles.btnPrimary} onClick={handleNext}>
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
