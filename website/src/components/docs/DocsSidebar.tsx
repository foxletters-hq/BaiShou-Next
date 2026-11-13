import { type FC, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  DOCS_SIDEBAR,
  DOCS_UI,
  docsHref,
  type DocsLocale,
} from '../../data/docs-nav';

interface DocsSidebarProps {
  locale: DocsLocale;
  slug: string;
  sidebarRef: RefObject<HTMLElement>;
  onClose: () => void;
}

export const DocsSidebar: FC<DocsSidebarProps> = ({
  locale,
  slug,
  sidebarRef,
  onClose,
}) => (
  <aside
    ref={sidebarRef}
    className="docs-sidebar"
    aria-label={DOCS_UI.menu[locale]}
  >
    <div className="docs-sidebar__top">
      <Link
        className="docs-nav__link docs-sidebar__home"
        to={docsHref(locale)}
        aria-current={slug === '' ? 'page' : undefined}
        onClick={onClose}
      >
        <svg
          className="docs-sidebar__home-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 7v14" />
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
        </svg>
        {DOCS_UI.home[locale]}
      </Link>
      <button
        type="button"
        className="docs-sidebar__close"
        data-docs-nav-close
        aria-label="关闭目录"
        onClick={onClose}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <nav className="docs-nav">
      {DOCS_SIDEBAR.map((group) => (
        <div key={group.id} className="docs-nav__group">
          <p className="docs-nav__label">{group.label[locale]}</p>
          <ul className="docs-nav__list">
            {group.items.map((item) => (
              <li key={item.slug}>
                <Link
                  className="docs-nav__link"
                  to={docsHref(locale, item.slug)}
                  aria-current={slug === item.slug ? 'page' : undefined}
                  onClick={onClose}
                >
                  {item.label[locale]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="docs-nav__site">
        <Link className="docs-nav__link" to="/" onClick={onClose}>
          {DOCS_UI.backSite[locale]}
        </Link>
      </div>
    </nav>
  </aside>
);

export default DocsSidebar;
