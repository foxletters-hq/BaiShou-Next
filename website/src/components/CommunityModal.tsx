import { useEffect, useRef, useState, type FC } from 'react';
import { QQ_GROUPS } from '../data/site';
import { useApp } from '../context/AppContext';

const PANEL_CLOSE_MS = 380;

export const CommunityModal: FC = () => {
  const { dict, isCommunityOpen, closeCommunityModal } = useApp();
  const [rendered, setRendered] = useState(false);
  const [openClass, setOpenClass] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isCommunityOpen) {
      setRendered(true);
      document.documentElement.classList.add('modal-open');
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setOpenClass(true);
          closeBtnRef.current?.focus();
        });
      });
      return () => cancelAnimationFrame(raf);
    }

    setOpenClass(false);
    document.documentElement.classList.remove('modal-open');
    const timer = window.setTimeout(() => {
      setRendered(false);
    }, PANEL_CLOSE_MS + 40);
    return () => window.clearTimeout(timer);
  }, [isCommunityOpen]);

  useEffect(() => {
    if (!isCommunityOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCommunityModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCommunityOpen, closeCommunityModal]);

  return (
    <div
      className={['community-modal', openClass && 'is-open']
        .filter(Boolean)
        .join(' ')}
      data-community-modal
      hidden={!rendered}
      aria-hidden={!isCommunityOpen}
    >
      <div
        className="community-modal-backdrop"
        data-community-close
        tabIndex={-1}
        onClick={closeCommunityModal}
      />

      <div
        className="community-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-modal-title"
        data-lenis-prevent
      >
        <button
          ref={closeBtnRef}
          type="button"
          className="community-modal-close"
          data-community-close
          aria-label={dict.community.closeAria}
          data-i18n-aria-label="community.closeAria"
          onClick={closeCommunityModal}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <header className="community-modal-header">
          <p className="section-eyebrow" data-i18n="community.eyebrow">
            {dict.community.eyebrow}
          </p>
          <h2 id="community-modal-title" data-i18n="community.title">
            {dict.community.title}
          </h2>
          <p className="community-modal-lead" data-i18n="community.lead">
            {dict.community.lead}
          </p>
        </header>

        <div className="community-modal-grid">
          {QQ_GROUPS.map((group) => (
            <figure key={group.id} className="community-modal-card">
              <img
                src={group.qrImage}
                alt={dict.community.groups[group.id].qrAlt}
                className="community-modal-qr"
                width="280"
                height="420"
                loading="lazy"
                data-i18n-alt={`community.groups.${group.id}.qrAlt`}
              />
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommunityModal;
