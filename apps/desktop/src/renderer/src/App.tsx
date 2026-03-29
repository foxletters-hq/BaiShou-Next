import React, { useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { useSettingsStore } from '@baishou/store/stores/settings.store';
import './styles/index.css';

export const App: React.FC = () => {
  const { themeMode } = useSettingsStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  return (
    <div className="app-container">
      <TitleBar />
      <div className="app-main">
        <nav className="sidebar">
          {/* Sidebar navigation components */}
        </nav>
        <main className="content">
          {/* Main Router Content */}
          <div className="glass-panel">
            <h1>BaiShou Next</h1>
            <p>基于全新的跨平台框架与 AI 驱动。</p>
          </div>
        </main>
      </div>
    </div>
  );
};
