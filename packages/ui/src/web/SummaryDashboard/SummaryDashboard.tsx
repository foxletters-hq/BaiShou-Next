import React from 'react';
import { StatisticCard } from '../StatisticCard';
import './SummaryDashboard.css';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const SummaryDashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="summary-dashboard">
      <div className="dashboard-hero">
        <h2 className="hero-title">{t('summary.dashboard_title')}</h2>
        <p className="hero-subtitle">{t('summary.dashboard_subtitle')}</p>
      </div>
      
      <div className="stats-grid">
        <StatisticCard 
          title={t('summary.stats_total_diaries')} 
          value="1,245" 
          subtitle="+12 this week"
        />
        <StatisticCard 
          title={t('summary.stats_total_summaries')} 
          value="48" 
          subtitle="4 Types"
        />
        <StatisticCard 
          title={t('summary.stats_streak')} 
          value="15 Days" 
          subtitle="Keep it up!"
        />
      </div>
    </div>
  );
};
