import zhCN from '../i18n/locales/zh-CN';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE, type Locale } from '../i18n';
import { DOCS_LOCALES, docsHref, type DocsLocale } from '../data/docs-nav';
import { getDocEntry } from './docs';

export const SITE_ORIGIN = 'https://foxletters.com';

export interface AlternateLink {
  hreflang: string;
  href: string;
}

export interface RouteSeoMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImageUrl: string;
  locale: Locale;
  alternates: AlternateLink[];
  isDocs: boolean;
}

const OG_LOCALE_MAP: Record<Locale, string> = {
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  en: 'en_US',
  ja: 'ja_JP',
};

const DOCS_HOME_TITLES: Record<DocsLocale, string> = {
  'zh-CN': '白守使用文档',
  'zh-TW': '白守使用文件',
  en: 'BaiShou Docs',
  ja: '白守ドキュメント',
};

const DOCS_HOME_DESCRIPTIONS: Record<DocsLocale, string> = {
  'zh-CN': '白守官方使用文档：安装、日记、回忆、AI 伙伴、同步与备份。',
  'zh-TW': '白守官方使用文件：安裝、日記、回憶、AI 夥伴、同步與備份。',
  en: 'Official BaiShou docs — install, diary, memory, companions, sync & backup.',
  ja: '白守公式ドキュメント：インストール、日記、回憶、AI パートナー、同期とバックアップ。',
};

export function parseDocsPath(pathname: string): {
  isDocs: boolean;
  locale: DocsLocale;
  slug: string;
} {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  if (clean === 'docs' || clean.startsWith('docs/')) {
    return {
      isDocs: true,
      locale: 'zh-CN',
      slug: clean === 'docs' ? '' : clean.slice('docs/'.length),
    };
  }
  const match = clean.match(/^(en|ja|zh-tw)\/docs(?:\/(.*))?$/);
  if (match) {
    const rawLoc = match[1];
    const locale: DocsLocale =
      rawLoc === 'zh-tw' ? 'zh-TW' : (rawLoc as DocsLocale);
    return {
      isDocs: true,
      locale,
      slug: match[2] || '',
    };
  }
  return { isDocs: false, locale: 'zh-CN', slug: '' };
}

export function resolveRouteSeo(pathname: string): RouteSeoMeta {
  const ogImageUrl = `${SITE_ORIGIN}/assets/images/app-icon.png`;
  const { isDocs, locale, slug } = parseDocsPath(pathname);

  if (!isDocs) {
    return {
      title: zhCN.meta.title,
      description: zhCN.meta.description,
      canonicalUrl: `${SITE_ORIGIN}/`,
      ogImageUrl,
      locale: 'zh-CN',
      alternates: [],
      isDocs: false,
    };
  }

  const canonicalPath = docsHref(locale, slug);
  const canonicalUrl = new URL(canonicalPath, SITE_ORIGIN).href;
  const alternates: AlternateLink[] = [
    ...DOCS_LOCALES.map((loc) => ({
      hreflang: loc,
      href: new URL(docsHref(loc, slug), SITE_ORIGIN).href,
    })),
    {
      hreflang: 'x-default',
      href: new URL(docsHref('zh-CN', slug), SITE_ORIGIN).href,
    },
  ];

  if (!slug) {
    return {
      title: DOCS_HOME_TITLES[locale],
      description: DOCS_HOME_DESCRIPTIONS[locale],
      canonicalUrl,
      ogImageUrl,
      locale,
      alternates,
      isDocs: true,
    };
  }

  const entry = getDocEntry(locale, slug);
  const suffix = DOCS_HOME_TITLES[locale];
  const title = entry ? `${entry.title} | ${suffix}` : suffix;
  const description = entry?.description || DOCS_HOME_DESCRIPTIONS[locale];

  return {
    title,
    description,
    canonicalUrl,
    ogImageUrl,
    locale,
    alternates,
    isDocs: true,
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getInitialLocaleInlineScript(): string {
  return `(function(){try{var p=location.pathname||'';var dl=null;if(/^\\/en(\\/|$)/.test(p))dl='en';else if(/^\\/ja(\\/|$)/.test(p))dl='ja';else if(/^\\/zh-tw(\\/|$)/.test(p))dl='zh-TW';else if(/^\\/docs(\\/|$)/.test(p))dl='zh-CN';var k='${LOCALE_STORAGE_KEY}';var s=localStorage.getItem(k);var ua=(navigator.userAgent||'').toLowerCase();var bot=/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|baiduspider|sogou|bytespider|duckduckbot|applebot|semrush|ahrefs/.test(ua);var n=(navigator.language||'').toLowerCase();var l=dl||s||'${DEFAULT_LOCALE}';if(!dl&&!s&&!bot){if(n==='zh-tw'||n==='zh-hk'||n==='zh-mo')l='zh-TW';else if(n.indexOf('zh')===0)l='zh-CN';else if(n.indexOf('ja')===0)l='ja';else l='en';}if(['zh-CN','zh-TW','en','ja'].indexOf(l)<0)l='${DEFAULT_LOCALE}';document.documentElement.lang=l;document.documentElement.dataset.locale=l;}catch(e){}})();`;
}

export function renderSeoHeadHtml(meta: RouteSeoMeta): string {
  const ogLocale = OG_LOCALE_MAP[meta.locale] ?? 'zh_CN';
  const keywords =
    '白守, BaiShou, AI长期记忆, 人生关系图谱, 长期记忆, AI伴侣';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: '白守 BaiShou',
    applicationCategory: 'ProductivityApplication',
    operatingSystem: 'Windows, Android',
    url: meta.canonicalUrl,
    inLanguage: meta.locale,
    description: meta.description,
    image: meta.ogImageUrl,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
    author: {
      '@type': 'Organization',
      name: 'foxletters-hq',
      url: 'https://github.com/foxletters-hq',
    },
    featureList: [
      '日记与回忆',
      'AI 伙伴',
      '人生关系图谱',
      '向量与混合检索',
      '多端同步',
      '本地优先',
    ],
  };

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'foxletters-hq',
    url: 'https://github.com/foxletters-hq',
    logo: meta.ogImageUrl,
  };

  const alternatesHtml = meta.alternates
    .map(
      (alt) =>
        `<link rel="alternate" hreflang="${escapeAttr(alt.hreflang)}" href="${escapeAttr(alt.href)}">`,
    )
    .join('');

  return [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
    `<title>${escapeAttr(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttr(meta.description)}">`,
    `<meta name="keywords" content="${escapeAttr(keywords)}">`,
    '<meta name="author" content="foxletters-hq">',
    '<meta name="theme-color" content="#0a0f1e">',
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
    '<meta name="googlebot" content="index, follow">',
    `<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}">`,
    alternatesHtml,
    `<meta property="og:title" content="${escapeAttr(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttr(meta.description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${escapeAttr(meta.canonicalUrl)}">`,
    `<meta property="og:image" content="${escapeAttr(meta.ogImageUrl)}">`,
    '<meta property="og:image:alt" content="白守 BaiShou 应用图标">',
    `<meta property="og:locale" content="${ogLocale}">`,
    '<meta property="og:site_name" content="白守 BaiShou">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttr(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeAttr(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeAttr(meta.ogImageUrl)}">`,
    `<meta itemprop="name" content="${escapeAttr(meta.title)}">`,
    `<meta itemprop="description" content="${escapeAttr(meta.description)}">`,
    `<meta itemprop="image" content="${escapeAttr(meta.ogImageUrl)}">`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
    `<script type="application/ld+json">${JSON.stringify(orgLd)}</script>`,
    `<script>${getInitialLocaleInlineScript()}</script>`,
    '<script>(function(){var k="baishou-theme",s=localStorage.getItem(k),t=s==="light"||s==="dark"?s:window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t;})();</script>',
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap">',
    '<script defer src="https://analytics.foxletters.com/script.js" data-website-id="492c27a5-e336-48de-8e87-18f91003926d"></script>',
  ].join('');
}
