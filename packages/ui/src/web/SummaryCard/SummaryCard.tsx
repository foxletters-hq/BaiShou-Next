import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import './SummaryCard.css';

interface SummaryCardProps {
  id: string;
  title: string;
  dateRange: string;
  summaryText: string;
  type: 'week' | 'month' | 'quarter' | 'year';
  onClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'

export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  title, 
  dateRange, 
  summaryText, 
  type,
  onClick,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className={`summary-card-v2`} 
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
      
      {/* Hover action overlay for desktop */}
      <div className={`diary-card-v2-actions ${isHovered ? 'visible' : ''}`}>
        <div className="actions-divider" />
        <div className="actions-buttons">
          <button className="action-btn edit-btn" onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
            ✏️ {t('common.edit', '编辑')}
          </button>
          <button className="action-btn delete-btn" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
            🗑️ {t('common.delete', '删除')}
          </button>
        </div>
      </div>
    </div>
  );
};
