import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomeScreen } from './features/home/HomeScreen';
import { AgentScreen } from './features/agent/AgentScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { SessionManagementScreen } from './features/agent/SessionManagementScreen';
import { AssistantManagementScreen } from './features/agent/AssistantManagementScreen';
import { AssistantEditScreen } from './features/agent/AssistantEditScreen';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<OnboardingScreen />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />
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
