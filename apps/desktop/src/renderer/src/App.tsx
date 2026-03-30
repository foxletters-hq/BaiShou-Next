import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { HomeScreen } from './features/home/HomeScreen';
import { AgentScreen } from './features/agent/AgentScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/welcome" element={<OnboardingScreen />} />
        
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/c/:sessionId" element={<AgentScreen />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
