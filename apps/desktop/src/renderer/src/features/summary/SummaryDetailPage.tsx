import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer, useToast } from '@baishou/ui';
import { ArrowLeft, Calendar, Tag, Trash2, Copy, Clock } from 'lucide-react';
import './SummaryDetailPage.css';

interface SummaryDetail {
  id?: number;
  type: string;
  startDate: string;
  endDate: string;
  content: string;
  sourceIds?: string | null;
  generatedAt?: string;
}

/** 总结类型 → i18n 键映射 */
const TYPE_I18N_MAP: Record<string, string> = {
  weekly: 'summary.stats_week',
  monthly: 'summary.stats_month',
  quarterly: 'summary.stats_quarter',
  yearly: 'summary.stats_year',
};

/** 总结类型 → CSS 类名映射 */
const TYPE_CLASS_MAP: Record<string, string> = {
  weekly: 'type-weekly',
  monthly: 'type-monthly',
  quarterly: 'type-quarterly',
  yearly: 'type-yearly',
};

export const SummaryDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [summary, setSummary] = useState<SummaryDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!id || !window.electron) return;
      setLoading(true);
      try {
        const allSummaries: SummaryDetail[] = await window.electron.ipcRenderer.invoke('summary:list');
        const found = allSummaries.find(s => String(s.id) === id);
        if (found) {
          setSummary(found);
        } else {
          toast.showError(t('summary.not_found', '总结未找到'));
          navigate('/summary', { replace: true });
        }
      } catch (e) {
        console.error('[SummaryDetail] fetch error:', e);
        toast.showError(t('common.error', '加载失败'));
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [id, navigate, toast, t]);

  const handleCopy = async () => {
    if (!summary?.content) return;
    try {
      await navigator.clipboard.writeText(summary.content);
      toast.showSuccess(t('common.copy_success', '已复制到剪贴板'));
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'));
    }
  };

  const handleDelete = async () => {
    if (!summary) return;
    try {
      await window.electron.ipcRenderer.invoke(
        'summary:delete',
        summary.type,
        new Date(summary.startDate),
        new Date(summary.endDate)
      );
      toast.showSuccess(t('common.delete_success', '已删除'));
      navigate('/summary', { replace: true });
    } catch (e) {
      console.error('[SummaryDetail] delete error:', e);
      toast.showError(t('common.delete_failed', '删除失败'));
    }
  };

  const formatDate = (d: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatGeneratedAt = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="summary-detail-container">
        <div className="summary-detail-loading">
          <div className="summary-detail-spinner" />
          <span>{t('common.loading', '加载中...')}</span>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const typeClass = TYPE_CLASS_MAP[summary.type] || '';
  const typeLabel = t(TYPE_I18N_MAP[summary.type] || summary.type, summary.type);

  return (
    <div className="summary-detail-container">
      <div className="summary-detail-header">
        <button className="summary-detail-back" onClick={() => navigate('/summary')}>
          <ArrowLeft size={20} />
          <span>{t('common.back', '返回')}</span>
        </button>
        <div className="summary-detail-actions">
          <button className="summary-detail-action-btn" onClick={handleCopy} title={t('common.copy', '复制')}>
            <Copy size={16} />
          </button>
          <button className="summary-detail-action-btn danger" onClick={handleDelete} title={t('common.delete', '删除')}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="summary-detail-meta">
        <div className={`summary-detail-type-badge ${typeClass}`}>
          <Tag size={14} />
          {typeLabel}
        </div>
        <div className="summary-detail-date">
          <Calendar size={14} />
          <span>{formatDate(summary.startDate)} — {formatDate(summary.endDate)}</span>
        </div>
        {summary.generatedAt && (
          <div className="summary-detail-generated">
            <Clock size={14} />
            <span>{t('summary.generated_at', '生成于')} {formatGeneratedAt(summary.generatedAt)}</span>
          </div>
        )}
      </div>

      <div className="summary-detail-content">
        <MarkdownRenderer content={summary.content} />
      </div>
    </div>
  );
};
