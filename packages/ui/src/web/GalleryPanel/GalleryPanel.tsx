import { useTranslation } from 'react-i18next';
import React, { useState, useMemo } from 'react';
import { Edit3, Trash2, Calendar, Tag } from 'lucide-react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import './GalleryPanel.css';

export interface SummaryItem {
  id?: number;
  type: string;
  startDate: string;
  endDate: string;
  content: string;
  generatedAt?: string;
}

export interface GalleryPanelProps {
  summaries?: SummaryItem[];
  onOpen?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/** 总结类型 → i18n 键映射 */
const TYPE_I18N_MAP: Record<string, string> = {
  weekly: 'summary.stats_week',
  monthly: 'summary.stats_month',
  quarterly: 'summary.stats_quarter',
  yearly: 'summary.stats_year',
};

export const GalleryPanel: React.FC<GalleryPanelProps> = ({ 
  summaries = [], 
  onOpen, 
  onEdit, 
  onDelete 
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** 按类型过滤 */
  const filteredSummaries = useMemo(() => {
    return summaries.filter(s => s.type === activeTab);
  }, [summaries, activeTab]);

  /** 当前选中的总结 */
  const selectedSummary = useMemo(() => {
    if (selectedId) {
      return filteredSummaries.find(s => String(s.id) === selectedId);
    }
    return filteredSummaries[0];
  }, [filteredSummaries, selectedId]);

  /** 格式化日期范围 */
  const formatDateRange = (s: SummaryItem) => {
    if (!s.startDate || !s.endDate) return '';
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    
    if (s.type === 'weekly') {
      return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
    }
    if (s.type === 'monthly') {
      return `${start.getFullYear()}年${start.getMonth() + 1}月`;
    }
    if (s.type === 'quarterly') {
      const q = Math.ceil((start.getMonth() + 1) / 3);
      return `${start.getFullYear()}年 Q${q}`;
    }
    if (s.type === 'yearly') {
      return `${start.getFullYear()}年`;
    }
    return '';
  };

  /** 获取标题 */
  const getTitle = (s: SummaryItem) => {
    if (!s.startDate) return t('gallery.summary', '总结');
    const dateObj = new Date(s.startDate);
    
    if (s.type === 'weekly') {
      const weekNum = getWeekNumber(dateObj);
      return t('summary.card_week_title', '第 $week 周').replace('$week', String(weekNum));
    }
    if (s.type === 'monthly') {
      const month = dateObj.getMonth() + 1;
      return t('summary.card_month_title', '$month月').replace('$month', String(month));
    }
    if (s.type === 'quarterly') {
      const q = Math.ceil((dateObj.getMonth() + 1) / 3);
      const year = dateObj.getFullYear();
      return t('summary.missing_label_quarterly', '$year年Q$q')
        .replace('$year', String(year))
        .replace('$q', String(q));
    }
    if (s.type === 'yearly') {
      const year = dateObj.getFullYear();
      return t('summary.card_year_suffix', '$year年').replace('$year', String(year));
    }
    return t('gallery.summary', '总结');
  };

  /** 获取内容预览 */
  const getPreview = (content: string) => {
    if (!content) return '';
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed.replace(/[*_~`]/g, '').substring(0, 80);
      }
    }
    return '';
  };

  /** 计算周数 */
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - firstDayOfYear.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  };

  /** 处理列表项点击 */
  const handleItemClick = (id: string) => {
    setSelectedId(id);
    onOpen?.(id);
  };

  return (
    <div className="gallery-panel">
      {/* 标签栏 */}
      <div className="gallery-tabs-container">
        {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map(tab => (
          <button 
            key={tab}
            className={`gallery-tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              setSelectedId(null);
            }}
          >
            {t(`summary.tab_${tab}`, tab)}
          </button>
        ))}
      </div>

      {/* 双栏布局 */}
      <div className="gallery-layout">
        {/* 左侧列表 */}
        <div className="gallery-list">
          {filteredSummaries.length === 0 ? (
            <div className="gallery-list-empty">
              <Edit3 size={32} className="gallery-empty-icon" />
              <div className="gallery-empty-text">{t('diary.no_content', '暂无内容')}</div>
            </div>
          ) : (
            filteredSummaries.map((item) => {
              const id = String(item.id ?? '');
              const isSelected = selectedSummary?.id === item.id;
              
              return (
                <div
                  key={id}
                  className={`gallery-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleItemClick(id)}
                >
                  <div className="gallery-list-item-header">
                    <span className="gallery-list-item-title">
                      {getTitle(item)}
                    </span>
                    <span className="gallery-list-item-date">
                      {formatDateRange(item)}
                    </span>
                  </div>
                  {getPreview(item.content) && (
                    <div className="gallery-list-item-preview">
                      {getPreview(item.content)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 分隔线 */}
        <div className="gallery-divider" />

        {/* 右侧详情 */}
        <div className="gallery-detail">
          {selectedSummary ? (
            <>
              <div className="gallery-detail-header">
                <div className="gallery-detail-meta">
                  <span className="gallery-detail-type-badge">
                    <Tag size={12} />
                    {t(TYPE_I18N_MAP[selectedSummary.type] || selectedSummary.type, selectedSummary.type)}
                  </span>
                  <span className="gallery-detail-date">
                    <Calendar size={12} />
                    {formatDateRange(selectedSummary)}
                  </span>
                </div>
                <div className="gallery-detail-actions">
                  <button
                    className="gallery-action-btn"
                    onClick={() => onEdit?.(String(selectedSummary.id))}
                    title={t('common.edit', '编辑')}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="gallery-action-btn danger"
                    onClick={() => onDelete?.(String(selectedSummary.id))}
                    title={t('common.delete', '删除')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="gallery-detail-content">
                <MarkdownRenderer content={selectedSummary.content} />
              </div>
            </>
          ) : (
            <div className="gallery-detail-empty">
              <Edit3 size={48} className="gallery-empty-icon" />
              <div className="gallery-empty-text">
                {t('gallery.select_summary', '选择一个总结查看详情')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
