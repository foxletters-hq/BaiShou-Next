import type { FC } from 'react';
import {
  BILIBILI_URL,
  ICP_FILING_NUMBER,
  ICP_FILING_URL,
  MPS_FILING_NUMBER,
  MPS_FILING_URL,
  REPO_URL,
} from '../data/site';
import { useApp } from '../context/AppContext';
import BilibiliIcon from './BilibiliIcon';
import GithubIcon from './GithubIcon';
import QqIcon from './QqIcon';

export const SiteFooter: FC = () => {
  const { dict, openCommunityModal } = useApp();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-meta">
          <p className="footer-copy" data-i18n="footer.copy">
            {dict.footer.copy}
          </p>
          <div className="footer-filings">
            <a
              className="footer-beian"
              href={ICP_FILING_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ICP_FILING_NUMBER}
            </a>
            <a
              className="footer-beian footer-beian-mps"
              href={MPS_FILING_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                className="footer-beian-icon"
                src="/assets/images/gongan.png"
                alt=""
                width="16"
                height="16"
              />
              {MPS_FILING_NUMBER}
            </a>
          </div>
        </div>

        <div className="footer-actions">
          <button
            type="button"
            className="btn btn-outline footer-cta"
            data-community-open
            aria-label={dict.footer.joinCommunity}
            data-i18n-aria-label="footer.joinCommunity"
            onClick={openCommunityModal}
          >
            <QqIcon size={18} />
            <span data-i18n="footer.joinCommunity">
              {dict.footer.joinCommunity}
            </span>
          </button>

          <a
            href={BILIBILI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link footer-link-bilibili"
            aria-label={dict.footer.bilibili}
            data-i18n-aria-label="footer.bilibili"
          >
            <BilibiliIcon size={18} />
            <span data-i18n="footer.bilibili">{dict.footer.bilibili}</span>
          </a>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link footer-link-github"
            aria-label={dict.footer.github}
            data-i18n-aria-label="footer.github"
          >
            <GithubIcon size={18} />
            <span data-i18n="footer.github">{dict.footer.github}</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
