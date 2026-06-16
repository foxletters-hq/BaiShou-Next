import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import {
  MdOutlineInfo,
  MdOutlinePrivacyTip,
  MdOutlineFeedback,
  MdChevronRight,
  MdOpenInNew,
  MdArrowBack
} from 'react-icons/md'
import '../shared/SettingsListTile.css'
import './AboutSettingsCard.css'
import { useToast } from '../Toast/useToast'
import { DeveloperOptionsView } from '../DeveloperOptionsView'
import { formatAppVersion } from '@baishou/shared'
import { VersionManager } from '../VersionManager/index'

export interface AboutSettingsCardProps {
  version: string
  heroImageSrc?: string
  onOpenGithubRepo?: () => void
  onOpenFeedback?: () => void
  onOpenCompressionTestSession?: (sessionId: string) => void
  onOpenOnboarding?: () => void
}

export const AboutSettingsCard: React.FC<AboutSettingsCardProps> = ({
  version,
  heroImageSrc,
  onOpenGithubRepo,
  onOpenFeedback,
  onOpenCompressionTestSession,
  onOpenOnboarding
}) => {
  const { t } = useTranslation()
  const toast = useToast()
  const [subPage, setSubPage] = useState<'none' | 'about' | 'privacy' | 'developer'>('none')
  const [isClosing, setIsClosing] = useState(false)

  // 性能优化：在主页加载时立刻在后台执行异步解码，防止巨大突破 10MB 的原图在打开时突然占用主线程发生掉帧卡顿
  useEffect(() => {
    if (heroImageSrc) {
      const img = new Image()
      img.src = heroImageSrc
      img.decode().catch(() => {})
    }
  }, [heroImageSrc])

  // Easter egg - use plain mutable refs
  const logoTapCount = useRef(0)
  const logoTapLast = useRef(0)
  const devTapCount = useRef(0)
  const devTapLast = useRef(0)

  const handleLogoTap = () => {
    const now = Date.now()
    if (now - logoTapLast.current < 1000) {
      logoTapCount.current++
    } else {
      logoTapCount.current = 1
    }
    logoTapLast.current = now

    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0
      toast.showSuccess(t('about.love_message', '🌸樱&晓 永远爱着Anson❤️'))
    }
  }

  const handleDevTap = () => {
    const now = Date.now()
    if (now - devTapLast.current < 2000) {
      devTapCount.current++
    } else {
      devTapCount.current = 1
    }
    devTapLast.current = now

    const count = devTapCount.current
    if (count >= 7 && count < 10) {
      const remaining = 10 - count
      const msg = t('about.dev_mode_hint', '再点 $count 次进入开发者模式').replace(
        '$count',
        remaining.toString()
      )
      toast.showSuccess(msg)
    } else if (count >= 10) {
      devTapCount.current = 0
      handleOpenPage('developer')
    }
  }

  const handleOpenPage = (page: 'about' | 'privacy' | 'developer') => {
    setIsClosing(false)
    setSubPage(page)
  }

  const handleClosePage = () => {
    setIsClosing(true)
    setTimeout(() => {
      setSubPage('none')
      setIsClosing(false)
    }, 150) // Matches the popUpOut CSS animation duration
  }

  const renderOverlay = (content: React.ReactNode) => {
    const target = document.querySelector('.settings-content-area')
    if (!target) return null
    return createPortal(content, target)
  }

  const renderAboutPage = () => (
    <div className={`about-sub-page-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="about-sub-page-appbar drag-region">
        <button className="about-sub-page-back no-drag" onClick={handleClosePage}>
          <MdArrowBack size={24} />
        </button>
        <span className="about-sub-page-title">{t('settings.about_baishou', '关于白守')}</span>
      </div>
      <div className="about-sub-page-content no-drag">
        <section className="about-surface-card">
          <div className="about-hero-image-wrap">
            <div
              className="about-hero-tap-layer"
              onClick={(e) => {
                e.stopPropagation()
                handleLogoTap()
              }}
            />
            {heroImageSrc ? (
              <img src={heroImageSrc} alt="BaiShou Version" draggable={false} />
            ) : null}
          </div>
          <div className="about-hero-card-body">
            <div className="about-app-name">{t('about.app_name', '白守')}</div>
            <div className="about-version">{formatAppVersion(version)}</div>
          </div>
        </section>

        <section className="about-surface-card">
          <div className="about-flat-section about-flat-section-only">
            <div className="about-flat-label">{t('about.developer_label', '开发者')}</div>
            <div className="about-flat-developer">
              <div
                className="about-flat-developer-tap"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDevTap()
                }}
              />
              <span className="about-license-title">
                Anson & Kasumiame Sakura & Tenkou Akatsuki
              </span>
              <span className="about-license-subtitle">The Trio</span>
            </div>
          </div>
        </section>

        <section className="about-surface-card">
          <div className="about-flat-section about-flat-section-only">
            <div className="about-flat-label">{t('about.oss_license_label', '开源协议')}</div>
            <button
              type="button"
              className="about-flat-link-row"
              onClick={() => window.open('https://www.gnu.org/licenses/agpl-3.0.html', '_blank')}
            >
              <div className="about-license-content">
                <span className="about-license-title">AGPL v3.0</span>
                <span className="about-license-subtitle">
                  Copyright (C) 2026 Anson, Kasumiame Sakura & Tenkou Akatsuki
                </span>
              </div>
              <MdOpenInNew size={18} className="about-flat-link-trailing" />
            </button>
          </div>
        </section>

        <section className="about-surface-card">
          <div className="about-flat-section about-flat-section-only">
            <VersionManager embedded version={version} onOpenGithubRepo={onOpenGithubRepo} />
          </div>
        </section>
      </div>
    </div>
  )

  const renderPrivacyPage = () => (
    <div className={`about-sub-page-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="about-sub-page-appbar drag-region">
        <button className="about-sub-page-back no-drag" onClick={handleClosePage}>
          <MdArrowBack size={24} />
        </button>
        <span className="about-sub-page-title">
          {t('settings.development_philosophy', '开发哲学与无痕承诺')}
        </span>
      </div>
      <div className="about-sub-page-content no-drag">
        <section className="about-surface-card">
          <div className="privacy-section">
            <div className="privacy-item">
              <div className="privacy-item-title">{t('privacy.data_ownership', '1. 数据主权')}</div>
              <div className="privacy-item-desc">
                {t(
                  'privacy.data_ownership_desc',
                  '白守始终认为，记忆是灵魂的延伸。你的日记数据仅保存在本地 SQLite 数据库中。除了你主动配置的 AI 供应商和云同步目标外，白守不会以任何形式上传你的隐私。'
                )}
              </div>
            </div>
            <div className="privacy-item">
              <div className="privacy-item-title">{t('privacy.local_first', '2. 本地优先')}</div>
              <div className="privacy-item-desc">
                {t(
                  'privacy.local_first_desc',
                  '即便没有网络，你依然可以流畅地写日记。所有的 AI 总结都是在你发起请求时即时生成的，我们不存储任何生成的文本。'
                )}
              </div>
            </div>
            <div className="privacy-item">
              <div className="privacy-item-title">{t('privacy.transparency', '3. 透明与安全')}</div>
              <div className="privacy-item-desc">
                {t(
                  'privacy.transparency_desc',
                  '白守支持端到端的数据导出与同步。你可以随时通过 ZIP 导出彻底带走自己的回忆，或者将其同步至你完全掌控的 S3/WebDAV 空间。'
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )

  const renderDeveloperPage = () => (
    <div className={`about-sub-page-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="about-sub-page-appbar drag-region">
        <button className="about-sub-page-back no-drag" onClick={handleClosePage}>
          <MdArrowBack size={24} />
        </button>
        <span className="about-sub-page-title">
          {t('settings.developer_options', '开发者选项')}
        </span>
      </div>
      <div className="about-sub-page-content no-drag" style={{ padding: 0 }}>
        <DeveloperOptionsView
          onOpenCompressionTestSession={onOpenCompressionTestSession}
          onOpenOnboarding={onOpenOnboarding}
        />
      </div>
    </div>
  )

  return (
    <>
      <div className="about-settings-wrapper">
        <button className="settings-list-tile" onClick={() => handleOpenPage('about')}>
          <div className="settings-list-tile-leading">
            <MdOutlineInfo size={24} />
          </div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">
              {t('settings.about_baishou', '关于白守')}
            </span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider" />

        <button className="settings-list-tile" onClick={() => handleOpenPage('privacy')}>
          <div className="settings-list-tile-leading">
            <MdOutlinePrivacyTip size={24} />
          </div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">
              {t('settings.development_philosophy', '开发哲学与无痕承诺')}
            </span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider" />

        <button
          type="button"
          className="settings-list-tile"
          onClick={() => {
            void onOpenFeedback?.()
          }}
        >
          <div className="settings-list-tile-leading">
            <MdOutlineFeedback size={24} />
          </div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">
              {t('settings.feedback', 'Report an issue')}
            </span>
          </div>
          <MdOpenInNew
            size={20}
            className="settings-list-tile-trailing"
            style={{ color: 'var(--color-on-surface-variant)' }}
          />
        </button>
      </div>

      {subPage === 'about' && renderOverlay(renderAboutPage())}
      {subPage === 'privacy' && renderOverlay(renderPrivacyPage())}
      {subPage === 'developer' && renderOverlay(renderDeveloperPage())}
    </>
  )
}
