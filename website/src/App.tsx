import type { FC } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import HomePage from './pages/HomePage';
import DocsRoutePage from './pages/DocsRoutePage';
import './styles/global.css';
import './styles/docs.css';

export const App: FC = () => (
  <AppProvider>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/docs/*" element={<DocsRoutePage />} />
      <Route path="/en/docs/*" element={<DocsRoutePage />} />
      <Route path="/zh-tw/docs/*" element={<DocsRoutePage />} />
      <Route path="/ja/docs/*" element={<DocsRoutePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AppProvider>
);

export default App;
