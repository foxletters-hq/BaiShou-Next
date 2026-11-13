import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FC,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DOCS_UI, type DocsLocale } from '../../data/docs-nav';
import type { PagerLink, TocItem } from '../../lib/docs';
import Header from '../Header';
import SiteFooter from '../SiteFooter';
import CommunityModal from '../CommunityModal';
import DownloadPopup from '../DownloadPopup';
import DocsSidebar from './DocsSidebar';

export interface DocsLayoutProps {
  locale: DocsLocale;
  title: string;
  slug: string;
  headings?: TocItem[];
  prev?: PagerLink | null;
  next?: PagerLink | null;
  heroSlot?: ReactNode;
  htmlContent?: string;
}

const DOCS_SUFFIX: Record<DocsLocale, string> = {
  en: 'BaiShou Docs',
  ja: '白守ドキュメント',
  'zh-TW': '白守使用文件',
  'zh-CN': '白守使用文档',
};

interface DocsPagerProps {
  locale: DocsLocale;
  prev: PagerLink | null;
  next: PagerLink | null;
}

const DocsPager: FC<DocsPagerProps> = ({ locale, prev, next }) => {
  if (!prev && !next) return null;
  return (
    <nav className="docs-pager" aria-label="Pagination">
      {prev ? (
        <Link
          className="docs-pager__link docs-pager__link--prev"
          to={prev.href}
        >
          <span className="docs-pager__kicker">{DOCS_UI.prev[locale]}</span>
          <span className="docs-pager__title">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          className="docs-pager__link docs-pager__link--next"
          to={next.href}
        >
          <span className="docs-pager__kicker">{DOCS_UI.next[locale]}</span>
          <span className="docs-pager__title">{next.title}</span>
        </Link>
      )}
    </nav>
  );
};

interface DocsTocProps {
  locale: DocsLocale;
  toc: TocItem[];
  activeSlug: string;
  onSelect: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
}

const DocsToc: FC<DocsTocProps> = ({ locale, toc, activeSlug, onSelect }) => {
  if (toc.length === 0) return null;
  return (
    <aside className="docs-toc" aria-label={DOCS_UI.toc[locale]}>
      <p className="docs-toc__title">{DOCS_UI.toc[locale]}</p>
      <ul className="docs-toc__list">
        {toc.map((item) => (
          <li key={item.slug}>
            <a
              className={[
                'docs-toc__link',
                item.depth === 3 && 'docs-toc__link--h3',
              ]
                .filter(Boolean)
                .join(' ')}
              href={`#${item.slug}`}
              aria-current={activeSlug === item.slug ? 'true' : undefined}
              onClick={(e) => onSelect(e, item.slug)}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
};

function useDocsNavigationState(
  locale: DocsLocale,
  slug: string,
  sidebarRef: RefObject<HTMLElement>,
) {
  const [navOpen, setNavOpen] = useState(false);
  const [activeTocSlug, setActiveTocSlug] = useState<string>('');

  const scrollActiveSidebarIntoView = useCallback(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const active = sidebar.querySelector<HTMLElement>(
      '.docs-nav__link[aria-current="page"], .docs-sidebar__home[aria-current="page"]',
    );
    if (!active) return;
    const sidebarRect = sidebar.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const delta =
      activeRect.top -
      sidebarRect.top +
      sidebar.scrollTop -
      sidebar.clientHeight / 2 +
      activeRect.height / 2;
    sidebar.scrollTo({ top: Math.max(0, delta), behavior: 'auto' });
  }, [sidebarRef]);

  useEffect(() => {
    setNavOpen(false);
    setActiveTocSlug('');
    document.body.style.overflow = '';
    document.documentElement.classList.remove(
      'lenis',
      'lenis-smooth',
      'lenis-stopped',
    );
    window.scrollTo({ top: 0, behavior: 'auto' });
    scrollActiveSidebarIntoView();
  }, [locale, slug, scrollActiveSidebarIntoView]);

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    if (navOpen) requestAnimationFrame(scrollActiveSidebarIntoView);
    return () => {
      document.body.style.overflow = '';
    };
  }, [navOpen, scrollActiveSidebarIntoView]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navOpen]);

  return { navOpen, setNavOpen, activeTocSlug, setActiveTocSlug };
}

export const DocsLayout: FC<DocsLayoutProps> = ({
  locale,
  title,
  slug,
  headings = [],
  prev = null,
  next = null,
  heroSlot,
  htmlContent,
}) => {
  const navigate = useNavigate();
  const sidebarRef = useRef<HTMLElement>(null);
  const { navOpen, setNavOpen, activeTocSlug, setActiveTocSlug } =
    useDocsNavigationState(locale, slug, sidebarRef);

  const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);
  const pageTitle = slug === '' ? title : `${title} | ${DOCS_SUFFIX[locale]}`;

  const handleProseClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement)?.closest<HTMLAnchorElement>(
      'a[href]',
    );
    const href = anchor?.getAttribute('href');
    if (
      !anchor ||
      !href ||
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('#') ||
      anchor.target === '_blank'
    ) {
      return;
    }
    if (href.startsWith('/')) {
      event.preventDefault();
      navigate(href);
    }
  };

  const handleTocClick = (
    event: MouseEvent<HTMLAnchorElement>,
    itemSlug: string,
  ) => {
    const target = document.getElementById(itemSlug);
    if (!target) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    target.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    history.replaceState(null, '', `#${itemSlug}`);
    setActiveTocSlug(itemSlug);
  };

  return (
    <>
      <Header snapDots={false} />
      <div
        className="docs-shell"
        data-docs-root
        data-docs-locale={locale}
        data-docs-slug={slug}
        data-docs-title={pageTitle}
        data-nav-open={navOpen ? 'true' : undefined}
      >
        <DocsSidebar
          locale={locale}
          slug={slug}
          sidebarRef={sidebarRef}
          onClose={() => setNavOpen(false)}
        />
        <div className="docs-main">
          <div className="docs-article">
            {heroSlot ?? <h1 className="docs-article__title">{title}</h1>}
            <div
              className="docs-prose"
              onClick={handleProseClick}
              dangerouslySetInnerHTML={
                htmlContent ? { __html: htmlContent } : undefined
              }
            />
            <DocsPager locale={locale} prev={prev} next={next} />
          </div>
          <DocsToc
            locale={locale}
            toc={toc}
            activeSlug={activeTocSlug}
            onSelect={handleTocClick}
          />
        </div>
        <div
          className="docs-backdrop"
          data-docs-nav-close
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
        />
        <button
          type="button"
          className="docs-fab"
          data-docs-nav-toggle
          aria-label={DOCS_UI.menu[locale]}
          onClick={() => setNavOpen((prevOpen) => !prevOpen)}
        >
          <span className="docs-fab__icon" aria-hidden="true" />
          <span>{DOCS_UI.menu[locale]}</span>
        </button>
      </div>
      <SiteFooter />
      <CommunityModal />
      <DownloadPopup />
    </>
  );
};

export default DocsLayout;
