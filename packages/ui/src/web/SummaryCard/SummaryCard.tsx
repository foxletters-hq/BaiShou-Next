import React from 'react';
import './SummaryCard.css';

interface SummaryCardProps {
  id: string;
  title: string;
  dateRange: string;
  summaryText: string;
  type: 'week' | 'month' | 'quarter' | 'year';
  onClick?: () => void;
  onDelete?: () => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  title, 
  dateRange, 
  summaryText, 
  type,
  onClick,
  onDelete
}) => {
  const { t } = useTranslation();

  return (
    <div className={`summary-card-v2`} onClick={onClick}>
      <div className="summary-card-v2-header">
        <div className="summary-card-v2-type-badge">
          {t(`summary.stats_${type}`)}
        </div>
        <span className="summary-card-v2-date">{dateRange}</span>
      </div>
      
      <h3 className="summary-card-v2-title">{title}</h3>
      
      <div className="summary-card-v2-content">
        <div className="summary-card-mask">
          <p>{summaryText}</p>
        </div>
      </div>
      
      {onDelete && (
        <div className="summary-card-v2-actions">
           <button className="summary-action-icon" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              🗑️
           </button>
        </div>
      )}
    </div>
  );
};
