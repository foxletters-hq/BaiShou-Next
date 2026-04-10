import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { SummaryCard } from '../SummaryCard';
import './GalleryPanel.css';

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'


export interface GalleryPanelProps {
  summaries?: any[];
}

export const GalleryPanel: React.FC<GalleryPanelProps> = ({ summaries = [] }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');

  const formatDate = (d: any) => {
  if (!d) return '';
    const dateObj = new Date(d);
    return `${String(dateObj.getMonth() + 1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`;
  };

  const getTitle = (s: any) => {


    if (!s.startDate) return t('gallery.summary', '总结');
    const dateObj = new Date(s.startDate);
    if (s.type === 'weekly') return `${dateObj.getFullYear()}${t('common.year_unit', '年')}${t('gallery.weekly_report', '周报')}`;
    if (s.type === 'monthly') return `${dateObj.getFullYear()}${t('common.year_unit', '年')}${dateObj.getMonth() + 1}${t('common.month_unit', '月')}${t('gallery.summary', '总结')}`;
    if (s.type === 'quarterly') return `${dateObj.getFullYear()}${t('common.year_unit', '年')}Q${Math.ceil((dateObj.getMonth() + 1) / 3)}`;
    if (s.type === 'yearly') return `${dateObj.getFullYear()}${t('gallery.yearly_summary', '年度总结')}`;
    return t('gallery.summary', '总结');
  };

  const filteredSummaries = summaries.filter(s => (s.type || '').replace('ly', '') === activeTab.replace('ly', '') || s.type === activeTab);

  return (
    <div className="gallery-panel">
      <div className="gallery-tabs-container">
        {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(tab => (
          <button 
            key={tab}
            className={`gallery-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {t(`summary.tab_${tab}`)}
          </button>
        ))}
      </div>

      <div className="gallery-content gallery-mode-grid">
        {filteredSummaries.map((item, index) => (
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
        {filteredSummaries.length === 0 && (
          <div className="gallery-empty-state">
            <Edit3 size={48} className="gallery-empty-icon" />
            <div className="gallery-empty-text">{t('diary.no_content', '暂无内容')}</div>
          </div>
        )}
      </div>
    </div>
  );
};
