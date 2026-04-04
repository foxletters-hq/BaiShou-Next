import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomeScreen } from './features/home/HomeScreen';
import { AgentScreen } from './features/agent/AgentScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { SessionManagementScreen } from './features/agent/SessionManagementScreen';
import { AssistantManagementScreen } from './features/agent/AssistantManagementScreen';
import { AssistantEditScreen } from './features/agent/AssistantEditScreen';
import { AgentHomePage } from './features/agent/AgentHomePage';
import { AgentLayout } from './features/agent/AgentLayout';

// Phase 14: Recover Missing Feature Routes
import { DiaryPage } from './features/diary/DiaryPage';
import { DiaryEditorPage } from './features/diary/DiaryEditorPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SummaryPage } from './features/summary/SummaryPage';
import { useToast, DialogProvider, ToastProvider } from '@baishou/ui';
import { useEffect } from 'react';
import { useSettingsStore } from '@baishou/store';
import { i18n } from '@baishou/shared';

const GlobalErrorHandler = () => {
  const toast = useToast();

  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      e.preventDefault();
      toast.showError('操作异常：' + (e.reason?.message || e.reason || '未知网络或系统错误'));
    };
    
    const handleError = (e: ErrorEvent) => {
      e.preventDefault();
      toast.showError('系统警告：' + (e.message || '程序发生未知错误'));
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

export function App() {
  const locale = useSettingsStore(s => s.locale);

  // 确保 store 中持久化的语言设置在每次启动时同步到 i18n
  useEffect(() => {
    const lang = locale === 'system' ? navigator.language.split('-')[0] : locale;
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, [locale]);

  return (
    <HashRouter>
      <DialogProvider>
        <ToastProvider />
        <GlobalErrorHandler />
        <Routes>
          <Route path="/welcome" element={<OnboardingScreen />} />
          <Route path="/settings/*" element={<SettingsPage />} />
          
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomeScreen />} />
            
            {/* Main Business Logic Sub-Routes */}
            <Route path="/diary" element={<DiaryPage />} />
            <Route path="/diary/:dateStr" element={<DiaryEditorPage />} />
            <Route path="/summary" element={<SummaryPage />} />

            {/* AI / Agent Role Routing - Wrapped in AgentLayout */}
            <Route element={<AgentLayout />}>
              <Route path="/agent" element={<AgentHomePage />} />
              <Route path="/c/:sessionId" element={<AgentScreen />} />
            </Route>
            <Route path="/sessions" element={<SessionManagementScreen />} />
            <Route path="/assistants" element={<AssistantManagementScreen />} />
            <Route path="/assistants/new" element={<AssistantEditScreen />} />
            <Route path="/assistants/:assistantId/edit" element={<AssistantEditScreen />} />
          </Route>
        </Routes>
      </DialogProvider>
    </HashRouter>
  );
}
