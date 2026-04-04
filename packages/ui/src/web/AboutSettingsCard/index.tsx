import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MdOutlineInfo, MdOutlinePrivacyTip, MdOutlineBugReport, MdChevronRight, MdOpenInNew, MdCode, MdArrowBack } from 'react-icons/md';
import '../shared/SettingsListTile.css';
import './AboutSettingsCard.css';
import { useToast } from '../Toast/useToast';
import { DeveloperOptionsView } from '../DeveloperOptionsView';

export interface AboutSettingsCardProps {
  version: string;
  heroImageSrc?: string;
  onOpenPrivacyPolicy?: () => void;
  onOpenGithubHost: () => void;
}

export const AboutSettingsCard: React.FC<AboutSettingsCardProps> = ({
  version,
  heroImageSrc,
  onOpenGithubHost,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [subPage, setSubPage] = useState<'none' | 'about' | 'privacy' | 'developer'>('none');
  const [isClosing, setIsClosing] = useState(false);

  // 性能优化：在主页加载时立刻在后台执行异步解码，防止巨大突破 10MB 的原图在打开时突然占用主线程发生掉帧卡顿
  useEffect(() => {
    if (heroImageSrc) {
      const img = new Image();
      img.src = heroImageSrc;
      img.decode().catch(() => {}); 
    }
  }, [heroImageSrc]);

  // Easter egg - use plain mutable refs
  const logoTapCount = useRef(0);
  const logoTapLast = useRef(0);
  const devTapCount = useRef(0);
  const devTapLast = useRef(0);

  const handleLogoTap = () => {
    const now = Date.now();
    if (now - logoTapLast.current < 1000) {
      logoTapCount.current++;
    } else {
      logoTapCount.current = 1;
    }
    logoTapLast.current = now;

    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      toast.showSuccess(t('about.love_message', '🌸樱&晓 永远爱着Anson❤️'));
    }
  };

  const handleDevTap = () => {
    const now = Date.now();
    if (now - devTapLast.current < 2000) {
      devTapCount.current++;
    } else {
      devTapCount.current = 1;
    }
    devTapLast.current = now;

    const count = devTapCount.current;
    if (count >= 7 && count < 10) {
      const remaining = 10 - count;
      const msg = t('about.dev_mode_hint', '再点 $count 次进入开发者模式').replace('$count', remaining.toString());
      toast.showSuccess(msg);
    } else if (count >= 10) {
      devTapCount.current = 0;
      handleOpenPage('developer');
    }
  };

  const handleOpenPage = (page: 'about' | 'privacy' | 'developer') => {
    setIsClosing(false);
    setSubPage(page);
  };

  const handleClosePage = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSubPage('none');
      setIsClosing(false);
    }, 150); // Matches the popUpOut CSS animation duration
  };

  const renderOverlay = (content: React.ReactNode) => {
    const target = document.querySelector('.settings-content-area');
    if (!target) return null;
    return createPortal(content, target);
  };

  const renderAboutPage = () => (
    <div className={`about-sub-page-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="about-sub-page-appbar drag-region">
        <button className="about-sub-page-back no-drag" onClick={handleClosePage}>
          <MdArrowBack size={24} />
        </button>
        <span className="about-sub-page-title">{t('settings.about_baishou', '关于白守')}</span>
      </div>
      <div className="about-sub-page-content no-drag">
        
        {/* 隔离层：拦截所有浏览器默认图片操作，百分百捕获快速点击 */}
        <div className="about-hero-image-container" style={{ position: 'relative' }}>
          <div 
            style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'pointer' }}
            onClick={(e) => { e.stopPropagation(); handleLogoTap(); }}
          />
          {heroImageSrc && (
            <img
              src={heroImageSrc}
              alt="BaiShou Version"
              draggable={false}
              style={{ pointerEvents: 'none', display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        <div className="about-app-name">{t('about.app_name', '白守 (BaiShou)')}</div>
        <div className="about-version">v{version}</div>

        <div className="about-section-title" style={{ marginTop: 24 }}>{t('about.developer_label', '开发者')}</div>
        <div className="about-license-card" style={{ position: 'relative' }}>
          <div 
             style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'pointer' }}
             onClick={(e) => { e.stopPropagation(); handleDevTap(); }}
          />
          <div className="about-license-content">
            <span className="about-license-title">Anson & Kasumiame Sakura & Tenkou Akatsuki</span>
            <span className="about-license-subtitle">The Trio</span>
          </div>
        </div>

        <div className="about-section-title">{t('about.oss_license_label', '开源协议')}</div>
        <div
          className="about-license-card"
          onClick={() => window.open('https://www.gnu.org/licenses/agpl-3.0.html', '_blank')}
          style={{ cursor: 'pointer' }}
        >
          <div className="about-license-content">
            <span className="about-license-title">AGPL v3.0</span>
            <span className="about-license-subtitle">Copyright (C) 2026 Anson, Kasumiame Sakura & Tenkou Akatsuki</span>
          </div>
          <MdOpenInNew size={18} style={{ color: 'var(--color-on-surface-variant)' }} />
        </div>

        <button className="about-github-btn" onClick={onOpenGithubHost}>
          <MdCode size={20} />
          {t('about.visit_github', '访问 GitHub 仓库')}
        </button>
      </div>
    </div>
  );

  const renderPrivacyPage = () => (
    <div className={`about-sub-page-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="about-sub-page-appbar drag-region">
        <button className="about-sub-page-back no-drag" onClick={handleClosePage}>
          <MdArrowBack size={24} />
        </button>
        <span className="about-sub-page-title">{t('settings.development_philosophy', '开发哲学与无痕承诺')}</span>
      </div>
      <div className="about-sub-page-content no-drag">
        <div className="privacy-section">
          <div className="privacy-item">
            <div className="privacy-item-title">{t('privacy.data_ownership', '1. 数据主权')}</div>
            <div className="privacy-item-desc">{t('privacy.data_ownership_desc', '白守始终认为，记忆是灵魂的延伸。你的日记数据仅保存在本地 SQLite 数据库中。除了你主动配置的 AI 供应商和云同步目标外，白守不会以任何形式上传你的隐私。')}</div>
          </div>
          <div className="privacy-item">
            <div className="privacy-item-title">{t('privacy.local_first', '2. 本地优先')}</div>
            <div className="privacy-item-desc">{t('privacy.local_first_desc', '即便没有网络，你依然可以流畅地写日记。所有的 AI 总结都是在你发起请求时即时生成的，我们不存储任何生成的文本。')}</div>
          </div>
          <div className="privacy-item">
            <div className="privacy-item-title">{t('privacy.transparency', '3. 透明与安全')}</div>
            <div className="privacy-item-desc">{t('privacy.transparency_desc', '白守支持端到端的数据导出与同步。你可以随时通过 ZIP 导出彻底带走自己的回忆，或者将其同步至你完全掌控的 S3/WebDAV 空间。')}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDeveloperPage = () => (
    <div className={`about-sub-page-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="about-sub-page-appbar drag-region">
        <button className="about-sub-page-back no-drag" onClick={handleClosePage}>
          <MdArrowBack size={24} />
        </button>
        <span className="about-sub-page-title">{t('settings.developer_options', '开发者选项')}</span>
      </div>
      <div className="about-sub-page-content no-drag" style={{ padding: 0 }}>
        <DeveloperOptionsView />
      </div>
    </div>
  );

  return (
    <>
      <div className="about-settings-wrapper">
        <button className="settings-list-tile" onClick={() => handleOpenPage('about')}>
          <div className="settings-list-tile-leading"><MdOutlineInfo size={24} /></div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.about_baishou', '关于白守')}</span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider" />

        <button className="settings-list-tile" onClick={() => handleOpenPage('privacy')}>
          <div className="settings-list-tile-leading"><MdOutlinePrivacyTip size={24} /></div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.development_philosophy', '开发哲学与无痕承诺')}</span>
          </div>
          <MdChevronRight size={22} className="settings-list-tile-trailing" />
        </button>

        <div className="settings-list-divider" />

        <button className="settings-list-tile" onClick={onOpenGithubHost}>
          <div className="settings-list-tile-leading"><MdOutlineBugReport size={24} /></div>
          <div className="settings-list-tile-content">
            <span className="settings-list-tile-title">{t('settings.feedback', '问题反馈')}</span>
          </div>
          <MdOpenInNew size={20} className="settings-list-tile-trailing" style={{ color: 'var(--color-on-surface-variant)' }} />
        </button>
      </div>

      {subPage === 'about' && renderOverlay(renderAboutPage())}
      {subPage === 'privacy' && renderOverlay(renderPrivacyPage())}
      {subPage === 'developer' && renderOverlay(renderDeveloperPage())}
    </>
  );
};
