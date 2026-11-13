import docsManifestRaw from '../generated/docs-manifest.json';
import {
  DOCS_LOCALES,
  DOCS_SIDEBAR,
  allDocSlugs,
  docsEntryId,
  docsHref,
  type DocsLocale,
} from '../data/docs-nav';

export { allDocSlugs };

export interface TocItem {
  depth: number;
  slug: string;
  text: string;
}

export interface PagerLink {
  href: string;
  title: string;
}

export interface DocEntry {
  id: string;
  title: string;
  description?: string;
  html: string;
  headings: TocItem[];
}

const docsManifest = docsManifestRaw as Record<
  string,
  { title: string; description?: string; html: string; headings: TocItem[] }
>;

export function isDocsLocale(value: string): value is DocsLocale {
  return (DOCS_LOCALES as string[]).includes(value);
}

export function localeFromParam(param: string | undefined): DocsLocale {
  if (!param || param === 'docs') return 'zh-CN';
  if (param === 'zh-tw') return 'zh-TW';
  if (param === 'en' || param === 'ja') return param;
  return 'zh-CN';
}

export function getDocEntry(locale: DocsLocale, slug: string): DocEntry | null {
  const id = docsEntryId(locale, slug);
  const raw = docsManifest[id];
  if (!raw) return null;
  return {
    id,
    title: raw.title,
    description: raw.description,
    html: raw.html,
    headings: raw.headings ?? [],
  };
}

export function getAllDocEntries(locale: DocsLocale): DocEntry[] {
  const prefix =
    locale === 'zh-CN'
      ? 'docs/'
      : locale === 'zh-TW'
        ? 'zh-tw/docs/'
        : `${locale}/docs/`;
  return Object.entries(docsManifest)
    .filter(([id]) => id.startsWith(prefix) && !id.endsWith('index'))
    .map(([id, raw]) => ({
      id,
      title: raw.title,
      description: raw.description,
      html: raw.html,
      headings: raw.headings ?? [],
    }));
}

export function flatNav(locale: DocsLocale) {
  return DOCS_SIDEBAR.flatMap((g) =>
    g.items.map((item) => ({
      slug: item.slug,
      title: item.label[locale],
      href: docsHref(locale, item.slug),
    })),
  );
}

export function pagerFor(locale: DocsLocale, slug: string): {
  prev: PagerLink | null;
  next: PagerLink | null;
} {
  const list = flatNav(locale);
  const idx = list.findIndex((i) => i.slug === slug);
  if (idx < 0) return { prev: null, next: null };
  const prev = idx > 0 ? list[idx - 1] : null;
  const next = idx < list.length - 1 ? list[idx + 1] : null;
  return {
    prev: prev ? { href: prev.href, title: prev.title } : null,
    next: next ? { href: next.href, title: next.title } : null,
  };
}

export function staticPathsForLocale(locale: DocsLocale) {
  return allDocSlugs().map((slug) => ({
    params: { slug },
    props: { locale, slug },
  }));
}
