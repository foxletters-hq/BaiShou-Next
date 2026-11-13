import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, messages } from '../src/i18n';
import { DOCS_LOCALES, allDocSlugs } from '../src/data/docs-nav';
import { getDocEntry, pagerFor } from '../src/lib/docs';
import { getPrerenderRoutes, renderRoute } from '../src/entry-server';

function findFilesByExt(
  dir: string,
  ext: string,
  found: string[] = [],
): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      findFilesByExt(full, ext, found);
    } else if (name.endsWith(ext)) {
      found.push(full);
    }
  }
  return found;
}

describe('@baishou/website React & SSG architecture', () => {
  it('removes all legacy .astro files and uses @baishou/website package name', () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { name: string };
    expect(pkg.name).toBe('@baishou/website');

    const astroFiles = findFilesByExt(join(process.cwd(), 'src'), '.astro');
    expect(astroFiles).toHaveLength(0);
  });

  it('provides complete 4-locale i18n dictionaries', () => {
    for (const locale of LOCALES) {
      const dict = messages[locale];
      expect(dict.meta.title).toBeTruthy();
      expect(dict.hero.title).toBeTruthy();
      expect(dict.features.items.diary.title).toBeTruthy();
      expect(dict.principles.items.local.title).toBeTruthy();
      expect(dict.origin.trio.anson.name).toBeTruthy();
      expect(dict.mascot.name).toBeTruthy();
      expect(dict.people.wallTitle).toBeTruthy();
    }
  });

  it('compiles all 104 multi-language markdown docs with custom asides and table wrappers', () => {
    const slugs = allDocSlugs();
    expect(slugs.length).toBe(26);

    for (const locale of DOCS_LOCALES) {
      for (const slug of slugs) {
        const entry = getDocEntry(locale, slug);
        expect(
          entry,
          `Missing doc entry for ${locale}: ${slug}`,
        ).not.toBeNull();
        expect(entry?.title).toBeTruthy();
        expect(entry?.html.length).toBeGreaterThan(20);
      }
    }

    const installDoc = getDocEntry('zh-CN', 'getting-started/install');
    expect(installDoc?.html).toContain('docs-table-wrap');
    expect(installDoc?.html).toContain('docs-aside docs-aside--caution');
    expect(installDoc?.headings.length).toBeGreaterThan(0);

    const pager = pagerFor('zh-CN', 'getting-started/install');
    expect(pager.prev?.href).toBe('/docs/getting-started/what-is-baishou/');
    expect(pager.next?.href).toBe('/docs/getting-started/first-launch/');
  });

  it('prerenders home page and localized docs routes with complete SEO metadata', () => {
    const routes = getPrerenderRoutes();
    expect(routes).toHaveLength(1 + 4 + 26 * 4);

    const home = renderRoute('/');
    expect(home.htmlLang).toBe('zh-CN');
    expect(home.bodyClass).toBe('');
    expect(home.headHtml).toContain(
      '<link rel="canonical" href="https://foxletters.com/">',
    );
    expect(home.appHtml).toContain('以纯白誓约，守护彼此一生');
    expect(home.appHtml).toContain('Latte · 拉提');

    const jaDoc = renderRoute('/ja/docs/getting-started/install/');
    expect(jaDoc.htmlLang).toBe('ja');
    expect(jaDoc.bodyClass).toBe('plain-bg');
    expect(jaDoc.headHtml).toContain(
      '<link rel="canonical" href="https://foxletters.com/ja/docs/getting-started/install/">',
    );
    expect(jaDoc.headHtml).toContain('hreflang="zh-CN"');
    expect(jaDoc.headHtml).toContain('property="og:locale" content="ja_JP"');
    expect(jaDoc.appHtml).toContain('docs-shell');
  });
});
