import React, { useState } from 'react';
import { SummaryCard } from '../SummaryCard';
import './GalleryPanel.css';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export interface GalleryPanelProps {
  summaries?: any[];
}

export const GalleryPanel: React.FC<GalleryPanelProps> = ({ summaries = [] }) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');

  const formatDate = (d: any) => {
    if (!d) return '';
    const dateObj = new Date(d);
    return `${String(dateObj.getMonth() + 1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
  };

  const getTitle = (s: any) => {
    if (!s.startDate) return '总结';
    const dateObj = new Date(s.startDate);
    if (s.type === 'weekly') return `${dateObj.getFullYear()}年周报`;
    if (s.type === 'monthly') return `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月总结`;
    if (s.type === 'quarterly') return `${dateObj.getFullYear()}年Q${Math.ceil((dateObj.getMonth() + 1) / 3)}`;
    if (s.type === 'yearly') return `${dateObj.getFullYear()}年度总结`;
    return '总结';
  };

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
        {summaries.map((item, index) => (
          <SummaryCard 
            key={item.id ?? index}
            id={String(item.id ?? index)}
            title={getTitle(item)}
            dateRange={`${formatDate(item.startDate)}-${formatDate(item.endDate)}`}
            summaryText={item.content || ''}
            type={(item.type || '').replace('ly', '') as any}
            onClick={() => console.log('Open', item.id)}
          />
        ))}
      </div>
    </div>
  );
};
