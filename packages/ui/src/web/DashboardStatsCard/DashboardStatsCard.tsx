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

const SolidBook = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,2H6C4.89,2 4,2.89 4,4V20C4,21.11 4.89,22 6,22H19C20.11,22 21,21.11 21,20V4C21,2.89 20.11,2 19,2M14,10C14,10 13.5,9.5 13,9.5C12.5,9.5 12,10 12,10V4H14V10Z" /></svg>;
const SolidCalendar = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19,4H18V2H16V4H8V2H6V4H5C3.89,4 3.01,4.9 3.01,6L3,20C3,21.1 3.89,22 5,22H19C20.1,22 21,21.1 21,20V6C21,4.9 20.1,4 19,4M19,20H5V10H19V20Z" /></svg>;
const SolidFolder = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18C2,19.1 2.89,20 4,20H20C21.1,20 22,19.1 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" /></svg>;
const SolidPieChart = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2 0v8h8c-.5-4.08-3.92-7.5-8-8zm0 10v10c4.08-.5 7.5-3.92 8-8h-8z"/></svg>;
const SolidDateRange = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 11H7V13H9V11ZM13 11H11V13H13V11ZM17 11H15V13H17V11ZM19 4H18V2H16V4H8V2H6V4H5C3.89 4 3 4.9 3 6V20C3 21.1 3.89 22 5 22H19C20.1 22 21 21.1 21 20V6C21 4.9 20.1 4 19 4ZM19 20H5V9H19V20Z" /></svg>;
const SolidChart = () => <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>;

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
      <div className="stats-icon-wrapper">
        <span className="stats-icon">{icon}</span>
      </div>
      <div className="stats-info">
        <div className="stats-count">{count}</div>
        <div className="stats-label">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="dashboard-stats-card">
      <div className="stats-header">
        <span className="stats-header-icon" style={{ color: '#16a34a' }}>
          <SolidChart />
        </span>
        <span className="stats-header-title">
          {t('common.app_title', '白守')} · {t('summary.stats_panel', '统计面板')}
        </span>
      </div>

      <div className="stats-grid">
        <div className="stats-row">
          {renderStatTile(<SolidBook />, totalDiaryCount, t('summary.stats_daily', '日记总数'), 'color-green')}
          {renderStatTile(<SolidCalendar />, totalWeeklyCount, t('summary.stats_weekly', '周统总数'), 'color-indigo')}
        </div>
        <div className="stats-row">
          {renderStatTile(<SolidFolder />, totalMonthlyCount, t('summary.stats_monthly', '月统总数'), 'color-blue')}
          {renderStatTile(<SolidPieChart />, totalQuarterlyCount, t('summary.stats_quarterly', '季统总数'), 'color-amber')}
        </div>
        <div className="stats-row full">
          {renderStatTile(<SolidDateRange />, totalYearlyCount, t('summary.stats_yearly', '年统总数'), 'color-orange')}
        </div>
      </div>
    </div>
  );
};
