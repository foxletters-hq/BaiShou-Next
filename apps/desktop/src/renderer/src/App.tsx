import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomeScreen } from './features/home/HomeScreen';
import { AgentScreen } from './features/agent/AgentScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { SessionManagementScreen } from './features/agent/SessionManagementScreen';
import { AssistantManagementScreen } from './features/agent/AssistantManagementScreen';
import { AssistantEditScreen } from './features/agent/AssistantEditScreen';
import { AgentLayout } from './features/agent/AgentLayout';

// Phase 14: Recover Missing Feature Routes
import { DiaryPage } from './features/diary/DiaryPage';
import { DiaryEditorPage } from './features/diary/DiaryEditorPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SummaryPage } from './features/summary/SummaryPage';
import { SummaryDetailPage } from './features/summary/SummaryDetailPage';
import { LanTransferPage } from './features/settings/LanTransferPage';
import { CloudSyncPage } from './features/settings/CloudSyncPage';
import { GitManagementPage } from './features/settings/GitManagementPage';
import { useToast, useDialog, DialogProvider, ToastProvider } from '@baishou/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@baishou/store';
import { i18n } from '@baishou/shared';
import { TitleBar } from './components/TitleBar';
import { useZoom } from './hooks/useZoom';

const GlobalErrorHandler = () => {
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      toast.showError(t('app.error.operation', '操作异常：') + (e.reason?.message || e.reason || t('app.error.unknown_network', '未知网络或系统错误')));
    };
    
    const handleError = (e: ErrorEvent) => {
      e.preventDefault();
      toast.showError(t('app.error.system_warning', '系统警告：') + (e.message || t('app.error.unknown_program', '程序发生未知错误')));
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, [toast]);

  return null;
};

import { ErrorBoundary } from './ErrorBoundary';

const AppRoutes = () => {
  const location = useLocation();
  const dialog = useDialog();
  const [backgroundLocation, setBackgroundLocation] = useState(() => {
    if (location.pathname.startsWith('/settings')) {
      return { ...location, pathname: '/diary', state: null, key: 'default' };
    }
    return location;
  });
  const isSettings = location.pathname.startsWith('/settings');

  // 路由变化时关闭所有弹窗
  useEffect(() => {
    dialog.closeAll();
  }, [location.pathname]);

  useEffect(() => {
    if (!location.pathname.startsWith('/settings')) {
      setBackgroundLocation(location);
    }
  }, [location]);

  return (
    <>
      <Routes location={isSettings ? backgroundLocation : location}>
        <Route path="/welcome" element={<OnboardingScreen />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />
          
          {/* Main Business Logic Sub-Routes */}
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/diary/:dateStr" element={<DiaryEditorPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/summary/:id" element={<SummaryDetailPage />} />
          
          {/* Tools Routing */}
          <Route path="/lan-transfer" element={<LanTransferPage />} />
          <Route path="/data-sync" element={<CloudSyncPage />} />
          <Route path="/git" element={<GitManagementPage />} />

          {/* AI / Agent Role Routing - Wrapped in AgentLayout */}
          <Route element={<AgentLayout />}>
            <Route path="/chat/:sessionId?" element={<AgentScreen />} />
          </Route>
          <Route path="/sessions" element={<SessionManagementScreen />} />
          <Route path="/assistants" element={<AssistantManagementScreen />} />
          <Route path="/assistants/:id" element={<AssistantEditScreen />} />
        </Route>
      </Routes>

      {/* Settings Rendered as an Overlay to avoid unmounting MainLayout */}
      {isSettings && (
        <Routes>
          <Route path="/settings/*" element={<SettingsPage />} />
        </Routes>
      )}
    </>
  );
};

export function App() {
  useZoom();
  const locale = useSettingsStore(s => s.locale);

  const themeColor = useSettingsStore(s => s.themeColor);

  // 确保 store 中持久化的语言设置在每次启动时同步到 i18n
  useEffect(() => {
    const lang = locale === 'system' ? navigator.language.split('-')[0] : locale;
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [locale]);

  const themeMode = useSettingsStore(s => s.themeMode);

  // 监听并应用系统级/应用级的主题模式切换
  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    };

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);
      
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(themeMode === 'dark');
    }
  }, [themeMode]);

  useEffect(() => {
    if (themeColor) {
      document.documentElement.style.setProperty('--color-primary', themeColor);
      let hex = themeColor.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
      if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
      }
    }
  }, [themeColor]);

  return (
    <HashRouter>
      <DialogProvider>
        <ToastProvider />
        <GlobalErrorHandler />
        <ErrorBoundary>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
          <TitleBar />
          <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>
            <AppRoutes />
          </div>
        </div>
        </ErrorBoundary>
      </DialogProvider>
    </HashRouter>
  );
}
