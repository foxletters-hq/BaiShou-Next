import React from 'react';
import { 
  SummaryDashboard, GalleryPanel, 
  DashboardHeroBanner, DashboardStatsCard, DashboardSharedMemoryCard 
} from '@baishou/ui';
import { useSummaryDashboardMock } from './hooks/useSummaryDashboardMock';
import './SummaryPage.css';

// TODO: [Agent1-Dependency] 替换
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const { state, actions } = useSummaryDashboardMock();

  return (
    <div className="summary-page-container">
      {/* 顶部标签栏 */}
      <div className="sp-header">
        <div className="sp-tabs">
          <div 
            className={`sp-tab ${state.activeTab === 'panel' ? 'active' : ''}`}
            onClick={() => actions.setActiveTab('panel')}
          >
            {t('summary.panel_tab') || '面板'}
          </div>
          <div 
            className={`sp-tab ${state.activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => actions.setActiveTab('gallery')}
          >
            {t('summary.memory_gallery') || '记忆画廊'}
          </div>
        </div>
        <button className="sp-settings-btn" title="Summary Settings">🛠</button>
      </div>

      <div className="sp-content">
        {state.activeTab === 'panel' ? (
          <div className="sp-panel-view">
            <DashboardHeroBanner />
            <div className="sp-dashboard-layout">
              <DashboardSharedMemoryCard 
                lookbackMonths={state.lookbackMonths}
                onMonthsChanged={actions.setLookbackMonths}
                onCopyContext={actions.handleCopyContext}
              />
              <DashboardStatsCard {...state.stats} />
            </div>
          </div>
        ) : (
          <GalleryPanel />
        )}
      </div>
    </div>
  );
};
