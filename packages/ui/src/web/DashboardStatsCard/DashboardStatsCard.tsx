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

const MatAnalytics = ({ color, size }: { color: string, size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2V7h2v10zm4 0h-2v-3h2v3z"/></svg>
);

const MatBook = ({ color, size }: { color: string, size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>
);

const MatViewWeek = ({ color, size }: { color: string, size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M4 5h4v14H4zm6 0h4v14h-4zm6 0h4v14h-4z"/></svg>
);

const MatGridView = ({ color, size }: { color: string, size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M3 11h8V3H3v8zm0 10h8v-8H3v8zm10 0h8v-8h-8v8zm0-18v8h8V3h-8z"/></svg>
);

const MatDateRange = ({ color, size }: { color: string, size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>
);

const MatCalendarToday = ({ color, size }: { color: string, size: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M20 3h-1V1h-2v2H7V1H5v2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 18H4V8h16v13z"/></svg>
);

export const DashboardStatsCard: React.FC<DashboardStatsCardProps> = ({
  totalDiaryCount,
  totalWeeklyCount,
  totalMonthlyCount,
  totalQuarterlyCount,
  totalYearlyCount,
}) => {
  const { t } = useTranslation();

  const renderStatTile = (icon: React.ReactNode, count: number, label: string, colorVariant: string) => (
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
        <div className="stats-header-icon">
          <MatAnalytics size={20} color="#43A047" /> 
        </div>
        <span className="stats-header-title">
          {t('common.app_title', '白守')} · {t('summary.stats_panel', '统计面板')}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stats-row">
          {renderStatTile(<MatBook size={22} color="#4CAF50" />, totalDiaryCount, t('summary.stats_daily', '日记总数'), 'color-green')}
          {renderStatTile(<MatViewWeek size={22} color="#3F51B5" />, totalWeeklyCount, t('summary.stats_weekly', '周统总数'), 'color-indigo')}
        </div>
        <div className="stats-row">
          {renderStatTile(<MatGridView size={22} color="#2196F3" />, totalMonthlyCount, t('summary.stats_monthly', '月统总数'), 'color-blue')}
          {renderStatTile(<MatDateRange size={22} color="#FBC02D" />, totalQuarterlyCount, t('summary.stats_quarterly', '季统总数'), 'color-amber')}
        </div>
        <div className="stats-row full">
          {renderStatTile(<MatCalendarToday size={22} color="#FF9800" />, totalYearlyCount, t('summary.stats_yearly', '年统总数'), 'color-orange')}
        </div>
      </div>
    </div>
  );
};
