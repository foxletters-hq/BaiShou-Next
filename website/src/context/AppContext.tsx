import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  detectLocale,
  messages,
  type Locale,
  type Messages,
} from '../i18n';
import { docsHref } from '../data/docs-nav';
import { parseDocsPath, resolveRouteSeo } from '../lib/seo';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'baishou-theme';

const OG_LOCALE_MAP: Record<Locale, string> = {
  'zh-CN': 'zh_CN',
  'zh-TW': 'zh_TW',
  en: 'en_US',
  ja: 'ja_JP',
};

export interface AppContextValue {
  locale: Locale;
  dict: Messages;
  switchLocale: (next: Locale) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  isCommunityOpen: boolean;
  openCommunityModal: () => void;
  closeCommunityModal: () => void;
  isDownloadOpen: boolean;
  openDownloadModal: () => void;
  closeDownloadModal: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeInfo = useMemo(
    () => parseDocsPath(location.pathname),
    [location.pathname],
  );

  const [locale, setLocale] = useState<Locale>(() =>
    routeInfo.isDocs ? routeInfo.locale : DEFAULT_LOCALE,
  );
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isCommunityOpen, setCommunityOpen] = useState(false);
  const [isDownloadOpen, setDownloadOpen] = useState(false);

  // 初始化客户端真实主题与语言
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const resolvedTheme: ThemeMode =
      storedTheme === 'light' || storedTheme === 'dark'
        ? storedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    setTheme(resolvedTheme);
    document.documentElement.dataset.theme = resolvedTheme;
  }, []);

  // 路由切换时同步语言、页面标题与 body 样式
  useEffect(() => {
    const nextLocale = routeInfo.isDocs ? routeInfo.locale : detectLocale();
    if (routeInfo.isDocs) {
      localStorage.setItem(LOCALE_STORAGE_KEY, routeInfo.locale);
    }
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dataset.locale = nextLocale;
    document.documentElement.dataset.i18nReady = 'true';
    document.body.classList.toggle('plain-bg', routeInfo.isDocs);

    const seo = resolveRouteSeo(location.pathname);
    if (routeInfo.isDocs) {
      document.title = seo.title;
    } else {
      const activeDict = messages[nextLocale];
      document.title = activeDict.meta.title;
      document
        .querySelector('meta[property="og:title"]')
        ?.setAttribute('content', activeDict.meta.title);
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', activeDict.meta.description);
      document
        .querySelector('meta[property="og:description"]')
        ?.setAttribute('content', activeDict.meta.description);
    }
    document
      .querySelector('meta[property="og:locale"]')
      ?.setAttribute('content', OG_LOCALE_MAP[nextLocale]);
  }, [location.pathname, routeInfo.isDocs, routeInfo.locale]);

  const switchLocale = useCallback(
    (next: Locale) => {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.documentElement.lang = next;
      document.documentElement.dataset.locale = next;
      setLocale(next);

      if (routeInfo.isDocs) {
        navigate(docsHref(next, routeInfo.slug));
        return;
      }

      const activeDict = messages[next];
      document.title = activeDict.meta.title;
      document
        .querySelector('meta[property="og:locale"]')
        ?.setAttribute('content', OG_LOCALE_MAP[next]);
    },
    [navigate, routeInfo.isDocs, routeInfo.slug],
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_STORAGE_KEY, next);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'dark' ? '#0a0f1e' : '#f4f7fb');
      return next;
    });
  }, []);

  const openCommunityModal = useCallback(() => setCommunityOpen(true), []);
  const closeCommunityModal = useCallback(() => setCommunityOpen(false), []);
  const openDownloadModal = useCallback(() => setDownloadOpen(true), []);
  const closeDownloadModal = useCallback(() => setDownloadOpen(false), []);

  const activeLocale = routeInfo.isDocs ? routeInfo.locale : locale;
  const dict = messages[activeLocale];

  const value = useMemo<AppContextValue>(
    () => ({
      locale: activeLocale,
      dict,
      switchLocale,
      theme,
      toggleTheme,
      isCommunityOpen,
      openCommunityModal,
      closeCommunityModal,
      isDownloadOpen,
      openDownloadModal,
      closeDownloadModal,
    }),
    [
      activeLocale,
      dict,
      switchLocale,
      theme,
      toggleTheme,
      isCommunityOpen,
      openCommunityModal,
      closeCommunityModal,
      isDownloadOpen,
      openDownloadModal,
      closeDownloadModal,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}
