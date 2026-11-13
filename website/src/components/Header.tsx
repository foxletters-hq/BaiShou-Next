import type { FC } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SNAP_SECTION_IDS, navHref } from '../data/site';
import { docsHref } from '../data/docs-nav';
import { t, type Messages } from '../i18n';
import { useApp } from '../context/AppContext';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';

export interface HeaderProps {
  snapDots?: boolean;
}

const SnapDotsNav: FC<{ dict: Messages }> = ({ dict }) => (
  <nav
    className="snap-dots"
    aria-label={dict.a11y.snapNav}
    data-i18n-aria-label="a11y.snapNav"
    data-snap-rail
  >
    <div className="snap-steps">
      <div className="snap-progress-track" aria-hidden="true">
        <div className="snap-progress-fill" data-snap-progress-fill />
      </div>
      {SNAP_SECTION_IDS.map((id, idx) => {
        const labelKey = id === 'hero' ? 'brand.name' : `nav.${id}`;
        const label = t(dict, labelKey);
        const stepNum = `0${idx + 1}`;
        return (
          <a
            key={id}
            href={navHref(id)}
            className={['snap-dot', idx === 0 && 'is-active']
              .filter(Boolean)
              .join(' ')}
            data-snap-dot={id}
            data-snap-index={idx}
            data-i18n-aria-label={labelKey}
            aria-label={label}
          >
            <span className="snap-dot-node" aria-hidden="true" />
            <span className="snap-dot-index" aria-hidden="true">
              {stepNum}
            </span>
            <span className="snap-dot-label" data-i18n={labelKey}>
              {label}
            </span>
          </a>
        );
      })}
    </div>
  </nav>
);

export const Header: FC<HeaderProps> = ({ snapDots = true }) => {
  const location = useLocation();
  const { locale, dict, openDownloadModal } = useApp();

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const isDocs = /(^|\/)docs(\/|$)/.test(path);
  const isHome = path === '/';
  const targetDocsHref = docsHref(locale);

  return (
    <>
      <header className="site-header">
        <div className="container site-header-shell">
          <div className="header-inner">
            <Link to="/" className="brand">
              <img
                src="/assets/images/app-icon.png"
                alt=""
                width="36"
                height="36"
                className="brand-icon"
              />
              <span className="brand-text">
                <span data-i18n="brand.name">{dict.brand.name}</span>
                <span className="brand-suffix" data-i18n="brand.suffix">
                  {dict.brand.suffix}
                </span>
              </span>
            </Link>

            <nav
              className="header-nav"
              aria-label={dict.a11y.mainNav}
              data-i18n-aria-label="a11y.mainNav"
            >
              <Link
                to="/"
                className={isHome ? 'is-active' : undefined}
                data-i18n="nav.home"
                aria-current={isHome ? 'page' : undefined}
              >
                {dict.nav.home}
              </Link>
              <Link
                to={targetDocsHref}
                className={isDocs ? 'is-active' : undefined}
                data-i18n="nav.docsAction"
                data-docs-link
                aria-current={isDocs ? 'page' : undefined}
              >
                {dict.nav.docsAction}
              </Link>
            </nav>

            <div className="header-actions">
              <button
                type="button"
                className="btn btn-primary header-dl-btn"
                data-dl-open
                aria-label={dict.download.button}
                data-i18n-aria-label="download.button"
                onClick={openDownloadModal}
              >
                <svg
                  className="header-dl-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 4v11" />
                  <path d="m7 11 5 5 5-5" />
                  <path d="M5 20h14" />
                </svg>
                <span className="header-dl-text" data-i18n="download.button">
                  {dict.download.button}
                </span>
              </button>
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      {snapDots && <SnapDotsNav dict={dict} />}
    </>
  );
};

export default Header;
