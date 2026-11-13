/**
 * SSG 静态预渲染与 Sitemap 生成脚本：
 * 将首页与全部四语言文档页预渲染为独立的静态 index.html，保证 SEO、直链访问与刷新零损失。
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DIST_DIR = join(ROOT, 'dist');
const DIST_SSR_DIR = join(ROOT, 'dist-ssr');
const SITE_ORIGIN = 'https://foxletters.com';

async function main() {
  const templateHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf8');
  const ssrEntryUrl = pathToFileURL(join(DIST_SSR_DIR, 'entry-server.js')).href;
  const { renderRoute, getPrerenderRoutes } = await import(ssrEntryUrl);

  const routes = getPrerenderRoutes();
  for (const route of routes) {
    const { appHtml, headHtml, htmlLang, bodyClass } = renderRoute(route);

    const pageHtml = templateHtml
      .replace('<html lang="zh-CN">', `<html lang="${htmlLang}">`)
      .replace('<!--app-head-->', headHtml)
      .replace(
        '<body>',
        bodyClass ? `<body class="${bodyClass}">` : '<body>',
      )
      .replace('<!--app-html-->', appHtml);

    const cleanRoute = route.replace(/^\/+|\/+$/g, '');
    const outPath = cleanRoute
      ? join(DIST_DIR, cleanRoute, 'index.html')
      : join(DIST_DIR, 'index.html');

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, pageHtml, 'utf8');
  }

  // 生成与原站点一致的 sitemap-index.xml 与 sitemap-0.xml
  const nowIso = new Date().toISOString();
  const sortedRoutes = [...routes].sort((a, b) => a.localeCompare(b));
  const urlEntries = sortedRoutes
    .map((r) => {
      const normalized = r === '/' ? '/' : `/${r.replace(/^\/+|\/+$/g, '')}/`;
      const loc = `${SITE_ORIGIN}${normalized}`;
      return `<url><loc>${loc}</loc><lastmod>${nowIso}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    })
    .join('');

  const sitemap0 = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">${urlEntries}</urlset>`;
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${SITE_ORIGIN}/sitemap-0.xml</loc></sitemap></sitemapindex>`;

  writeFileSync(join(DIST_DIR, 'sitemap-0.xml'), sitemap0, 'utf8');
  writeFileSync(join(DIST_DIR, 'sitemap-index.xml'), sitemapIndex, 'utf8');

  rmSync(DIST_SSR_DIR, { recursive: true, force: true });
  console.log(`已完成 ${routes.length} 个静态路由预渲染与 Sitemap 生成。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
