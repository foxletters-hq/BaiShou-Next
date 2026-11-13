import type { FC } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { docsHref, type DocsLocale } from '../data/docs-nav';
import { getDocEntry, pagerFor } from '../lib/docs';
import { parseDocsPath } from '../lib/seo';
import DocsLayout from '../components/docs/DocsLayout';
import DocsHome from '../components/docs/DocsHome';

const DOCS_TITLES: Record<DocsLocale, string> = {
  'zh-CN': '白守使用文档',
  'zh-TW': '白守使用文件',
  en: 'BaiShou Docs',
  ja: '白守ドキュメント',
};

export const DocsRoutePage: FC = () => {
  const location = useLocation();
  const { isDocs, locale, slug } = parseDocsPath(location.pathname);

  if (!isDocs) {
    return <Navigate to="/docs/" replace />;
  }

  if (!slug) {
    return (
      <DocsLayout
        locale={locale}
        title={DOCS_TITLES[locale]}
        slug=""
        heroSlot={<DocsHome locale={locale} />}
      />
    );
  }

  const entry = getDocEntry(locale, slug);
  if (!entry) {
    return <Navigate to={docsHref(locale)} replace />;
  }

  const { prev, next } = pagerFor(locale, slug);

  return (
    <DocsLayout
      locale={locale}
      title={entry.title}
      slug={slug}
      headings={entry.headings}
      prev={prev}
      next={next}
      htmlContent={entry.html}
    />
  );
};

export default DocsRoutePage;
