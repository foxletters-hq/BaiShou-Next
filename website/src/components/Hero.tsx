import type { FC } from 'react';
import { BILIBILI_URL, REPO_URL } from '../data/site';
import { useApp } from '../context/AppContext';
import BilibiliIcon from './BilibiliIcon';
import GithubIcon from './GithubIcon';
import QqIcon from './QqIcon';

export const Hero: FC = () => {
  const { dict, openCommunityModal } = useApp();

  return (
    <section id="hero" className="snap-page hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-eyebrow animate-in" data-i18n="hero.eyebrow">
            {dict.hero.eyebrow}
          </p>
          <h1
            className="hero-title animate-in animate-in-delay-1"
            data-i18n="hero.title"
          >
            {dict.hero.title}
          </h1>
          <p
            className="hero-tagline animate-in animate-in-delay-2"
            data-i18n="hero.tagline"
          >
            {dict.hero.tagline}
          </p>
          <p
            className="hero-positioning animate-in animate-in-delay-2"
            data-i18n="hero.positioning"
          >
            {dict.hero.positioning}
          </p>
          <p
            className="hero-desc animate-in animate-in-delay-3"
            data-i18n="hero.desc"
          >
            {dict.hero.desc}
          </p>
          <div className="hero-actions animate-in animate-in-delay-4">
            <button
              type="button"
              className="btn btn-outline"
              data-community-open
              onClick={openCommunityModal}
            >
              <QqIcon size={18} />
              <span data-i18n="hero.ctaCommunity">{dict.hero.ctaCommunity}</span>
            </button>
            <a
              href={BILIBILI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-bilibili"
            >
              <BilibiliIcon size={18} />
              <span data-i18n="hero.ctaBilibili">{dict.hero.ctaBilibili}</span>
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline"
            >
              <GithubIcon size={18} />
              <span data-i18n="hero.ctaGithub">{dict.hero.ctaGithub}</span>
            </a>
          </div>
        </div>

        <div className="hero-visual animate-in animate-in-delay-2">
          <div className="app-icon-frame" aria-hidden="true">
            <img
              src="/assets/images/app-icon.png"
              alt={dict.hero.iconAlt}
              className="app-icon-hero"
              data-i18n-alt="hero.iconAlt"
              width="420"
              height="420"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
