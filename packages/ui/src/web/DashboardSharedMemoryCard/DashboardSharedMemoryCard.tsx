import React from 'react';
import './DashboardSharedMemoryCard.css';

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number;
  onMonthsChanged: (val: number) => void;
  onCopyContext: () => void;
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext
}) => {
  const { t } = useTranslation();

  return (
    <div className="dashboard-shared-memory-card">
      <div className="sm-header">
         <span className="sm-header-icon">🌸</span>
         <span className="sm-header-title">{t('summary.shared_memory') || '共同回忆'}</span>
      </div>
      
      <p className="sm-desc">
        调整回溯月份，为 RAG 或大语言模型导出近期总结上下文片段。
      </p>

      <div className="sm-controls">
        <span className="sm-label">回溯 {lookbackMonths} 个月</span>
        <input 
          type="range" 
          min="1" 
          max="60" 
          value={lookbackMonths}
          onChange={(e) => onMonthsChanged(Number(e.target.value))}
          className="sm-slider"
        />
      </div>

      <button className="sm-btn" onClick={onCopyContext}>
        ✨ Copy 给 AI
      </button>
    </div>
  );
};
