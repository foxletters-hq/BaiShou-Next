import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import App from './App';
import { DOCS_LOCALES, allDocSlugs, docsHref } from './data/docs-nav';
import { renderSeoHeadHtml, resolveRouteSeo } from './lib/seo';

export interface PrerenderResult {
  appHtml: string;
  headHtml: string;
  htmlLang: string;
  bodyClass: string;
}

export function getPrerenderRoutes(): string[] {
  const routes: string[] = ['/'];
  const slugs = allDocSlugs();

  for (const locale of DOCS_LOCALES) {
    routes.push(docsHref(locale));
    for (const slug of slugs) {
      routes.push(docsHref(locale, slug));
    }
  }
  return routes;
}

export function renderRoute(url: string): PrerenderResult {
  const seo = resolveRouteSeo(url);
  const headHtml = renderSeoHeadHtml(seo);
  const appHtml = renderToString(
    <StrictMode>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );

  return {
    appHtml,
    headHtml,
    htmlLang: seo.locale,
    bodyClass: seo.isDocs ? 'plain-bg' : '',
  };
}
