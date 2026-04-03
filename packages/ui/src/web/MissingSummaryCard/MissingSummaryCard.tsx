import React from 'react';
import './MissingSummaryCard.css';

interface MissingSummaryCardProps {
  type: 'week' | 'month' | 'quarter' | 'year';
  dateRange: string;
  onGenerate: () => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export const MissingSummaryCard: React.FC<MissingSummaryCardProps> = ({ 
  type, 
  dateRange, 
  onGenerate 
}) => {
  const { t } = useTranslation();

  return (
    <div className={`missing-summary-card-v2`}>
      <div className="missing-icon-box">
        📅
      </div>
      
      <div className="missing-content-v2">
        <h4 className="missing-title-v2">{t(`summary.missing_title_${type}`)}</h4>
        <div className="missing-meta-v2">
           <span className="missing-date-v2">{dateRange}</span>
           <span className="missing-suggestion-v2">{t('summary.suggestion_generate') || '建议生成'}</span>
        </div>
      </div>
      
      <button className="missing-generate-btn-v2" onClick={onGenerate}>
        ✨
      </button>
    </div>
  );
};
