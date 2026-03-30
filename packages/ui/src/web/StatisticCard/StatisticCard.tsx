import React from 'react';
import './StatisticCard.css';

interface StatisticCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export const StatisticCard: React.FC<StatisticCardProps> = ({ title, value, subtitle, icon }) => {
  return (
    <div className="statistic-card">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
      </div>
      {subtitle && (
        <div className="stat-footer">
          <span className="stat-subtitle">{subtitle}</span>
        </div>
      )}
    </div>
  );
};
