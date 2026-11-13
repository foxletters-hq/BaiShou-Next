import {
  DOCS_SIDEBAR,
  type DocsLocale,
  type DocsNavGroup,
  type DocsNavItem,
} from './docs-sidebar';

export { DOCS_SIDEBAR, type DocsLocale, type DocsNavGroup, type DocsNavItem };

export const DOCS_LOCALES: DocsLocale[] = ['zh-CN', 'zh-TW', 'en', 'ja'];

export const DOCS_LOCALE_PREFIX: Record<DocsLocale, string> = {
  'zh-CN': '',
  'zh-TW': '/zh-tw',
  en: '/en',
  ja: '/ja',
};

export function docsHref(locale: DocsLocale, slug = ''): string {
  const prefix = DOCS_LOCALE_PREFIX[locale];
  if (!slug) return `${prefix}/docs/`;
  return `${prefix}/docs/${slug}/`;
}

/** content collection id，例如 docs/getting-started/install 或 en/docs/... */
export function docsEntryId(locale: DocsLocale, slug: string): string {
  if (locale === 'zh-CN') return `docs/${slug}`;
  if (locale === 'zh-TW') return `zh-tw/docs/${slug}`;
  return `${locale}/docs/${slug}`;
}

export function allDocSlugs(): string[] {
  return DOCS_SIDEBAR.flatMap((g) => g.items.map((i) => i.slug));
}

export const DOCS_UI = {
  toc: { 'zh-CN': '本页内容', 'zh-TW': '本頁內容', en: 'On this page', ja: '目次' },
  menu: { 'zh-CN': '文档目录', 'zh-TW': '文件目錄', en: 'Docs menu', ja: 'ドキュメントメニュー' },
  home: { 'zh-CN': '文档首页', 'zh-TW': '文件首頁', en: 'Docs home', ja: 'ドキュメントホーム' },
  prev: { 'zh-CN': '上一篇', 'zh-TW': '上一篇', en: 'Previous', ja: '前へ' },
  next: { 'zh-CN': '下一篇', 'zh-TW': '下一篇', en: 'Next', ja: '次へ' },
  backSite: { 'zh-CN': '返回官网', 'zh-TW': '返回官網', en: 'Website', ja: '公式サイト' },
} as const;
