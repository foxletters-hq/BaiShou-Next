import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomeScreen } from './features/home/HomeScreen';
import { AgentScreen } from './features/agent/AgentScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { SessionManagementScreen } from './features/agent/SessionManagementScreen';
import { AssistantManagementScreen } from './features/agent/AssistantManagementScreen';
import { AssistantEditScreen } from './features/agent/AssistantEditScreen';

// Phase 14: Recover Missing Feature Routes
import { DiaryPage } from './features/diary/DiaryPage';
import { DiaryEditorPage } from './features/diary/DiaryEditorPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SummaryPage } from './features/summary/SummaryPage';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<OnboardingScreen />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />
          
          {/* Main Business Logic Sub-Routes */}
          <Route path="/diary" element={<DiaryPage />} />
          <Route path="/diary/:dateStr" element={<DiaryEditorPage />} />
          <Route path="/summary" element={<SummaryPage />} />
          <Route path="/settings/*" element={<SettingsPage />} />

          {/* AI / Agent Role Routing */}
          <Route path="/c/:sessionId" element={<AgentScreen />} />
          <Route path="/sessions" element={<SessionManagementScreen />} />
          <Route path="/assistants" element={<AssistantManagementScreen />} />
          <Route path="/assistants/new" element={<AssistantEditScreen />} />
          <Route path="/assistants/:assistantId/edit" element={<AssistantEditScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
