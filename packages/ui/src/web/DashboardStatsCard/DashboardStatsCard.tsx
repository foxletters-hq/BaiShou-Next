import { useTranslation } from 'react-i18next';
import React from 'react';
import './DashboardStatsCard.css';

interface DashboardStatsCardProps {
  totalDiaryCount: number;
  totalWeeklyCount: number;
  totalMonthlyCount: number;
  totalQuarterlyCount: number;
  totalYearlyCount: number;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  totalDiaryCount,
  totalWeeklyCount,
  totalMonthlyCount,
  totalQuarterlyCount,
  totalYearlyCount,
}) => {
  const { t } = useTranslation();


  const renderStatTile = (icon: string, count: number, label: string, colorVariant: string) => (
    <div className={`stats-tile ${colorVariant}`}>
      <span className="stats-icon">{icon}</span>
      <div className="stats-info">
        <div className="stats-count">{count}</div>
        <div className="stats-label">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-stats-card">
      <div className="stats-header">
        <span className="stats-header-icon" style={{ color: '#16a34a' }}>📊</span>
        <span className="stats-header-title">
          {t('common.app_title') || '白守'} · {t('summary.stats_panel') || '统计面板'}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stats-row">
          {renderStatTile('📘', totalDiaryCount, t('summary.stats_daily') || '日记总数', 'color-green')}
          {renderStatTile('📅', totalWeeklyCount, t('summary.stats_weekly') || '周统总数', 'color-indigo')}
        </div>
        <div className="stats-row">
          {renderStatTile('🗂️', totalMonthlyCount, t('summary.stats_monthly') || '月统总数', 'color-blue')}
          {renderStatTile('📆', totalQuarterlyCount, t('summary.stats_quarterly') || '季统总数', 'color-amber')}
        </div>
        <div className="stats-row full">
          {renderStatTile('🗓️', totalYearlyCount, t('summary.stats_yearly') || '年统总数', 'color-orange')}
        </div>
      </div>
    </div>
  );
};
