import React, { useState } from 'react';
import { 
  GalleryPanel, 
  DashboardHeroBanner, DashboardStatsCard, DashboardSharedMemoryCard
} from '@baishou/ui';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSummaryDashboardMock } from './hooks/useSummaryDashboardMock';
import './SummaryPage.css';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state, actions } = useSummaryDashboardMock();

  // 模拟漏斗数据
  const [missingPeriods] = useState([
    { type: 'weekly' as const, dateRangeStr: '2026 第 13 周' }
  ]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' } }
  } as any;

  return (
    <div className="summary-page-container">
      {/* 顶部标签栏 Chrome Style */}
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

            {/* AI 建议补全区域 (MissingSummaryList 还原) */}
            <motion.div 
              style={{ marginTop: 24 }}
              variants={containerVariants}
              initial="hidden" animate="show"
            >
               {missingPeriods.map((mp, index) => (
                  <motion.div key={index} variants={itemVariants}>
                     <div 
                       onClick={() => navigate(`/editor?summaryType=${mp.type}`)}
                       style={{ cursor: 'pointer', marginBottom: 16 }}
                     >
                       <div className="sp-missing-card" style={{ padding: 20, border: '2px dashed var(--color-primary)', borderRadius: 12 }}>
                         <h3>{t('summary.missing_detect') || '发现缺失的'} {mp.type} 总结: {mp.dateRangeStr}</h3>
                         <p>点击马上让 AI 动笔生成</p>
                       </div>
                     </div>
                  </motion.div>
               ))}
            </motion.div>

          </div>
        ) : (
          <GalleryPanel />
        )}
      </div>
    </div>
  );
};
