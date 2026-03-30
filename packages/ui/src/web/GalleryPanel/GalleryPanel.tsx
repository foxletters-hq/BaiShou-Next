import React, { useState } from 'react';
import { SummaryCard } from '../SummaryCard';
import './GalleryPanel.css';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const GalleryPanel: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');

  const summaries = [
    { id: '1', title: '2026年第13周', dateRange: '03.24-03.30', type: 'week' as const, summaryText: '这一周的主题是基础架构的重构。完成了 Agent 2 的分工逻辑，搭建了核心组件骨架。' },
    { id: '2', title: '2026年3月总结', dateRange: '03.01-03.31', type: 'month' as const, summaryText: '本月完成了旧版 v3.0 的组件库对齐，并在多语言架构下实现了初步联调。' },
    { id: '3', title: '2026年第1季度', dateRange: '01.01-03.31', type: 'quarter' as const, summaryText: 'Q1 的大事件是启动了 BaiShou Next，一个从底层彻底翻新的版本，双端齐发。' }
  ];

  return (
    <div className="gallery-panel">
      <div className="gallery-header">
        <h3 className="gallery-title">{t('summary.gallery_title')}</h3>
        <div className="gallery-actions">
          <button 
            className={`view-btn ${viewMode === 'masonry' ? 'active' : ''}`}
            onClick={() => setViewMode('masonry')}
          >
            {t('summary.view_masonry')}
          </button>
          <button 
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
          >
            {t('summary.view_grid')}
          </button>
        </div>
      </div>

      <div className={`gallery-content gallery-mode-${viewMode}`}>
        {summaries.map(item => (
          <SummaryCard 
            key={item.id}
            id={item.id}
            title={item.title}
            dateRange={item.dateRange}
            summaryText={item.summaryText}
            type={item.type}
            onClick={() => console.log('Open', item.id)}
          />
        ))}
      </div>
    </div>
  );
};
