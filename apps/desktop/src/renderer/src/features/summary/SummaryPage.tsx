import { useTranslation } from 'react-i18next';
import React, { useState, useEffect, useRef } from 'react';
import {
  GalleryPanel,
  DashboardHeroBanner, DashboardStatsCard, DashboardSharedMemoryCard,
  ActivityHeatmap,
  useToast
} from '@baishou/ui';
import type { ActivityData } from '@baishou/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Layers, Sparkles, CheckCircle2, Gauge, Calendar, RefreshCw } from 'lucide-react';
import { useSummaryData } from './hooks/useSummaryData';
import './SummaryPage.css';




/** 并发数下拉选择器属性 */
interface ConcurrencyDropdownProps {
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
  t: (key: string, fallback?: string) => string;
}

/** 并发数下拉选择器 */
const ConcurrencyDropdown: React.FC<ConcurrencyDropdownProps> = ({ value, onChange, disabled, t }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="concurrency-dropdown">
      <button
        className="concurrency-trigger"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
      >
        <Gauge size={14} className="concurrency-trigger-icon" />
        <span className="concurrency-trigger-text">{t('summary.concurrency', '并发')}: {value}</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div className="concurrency-menu">
            {[1, 2, 3, 4, 5].map(n => (
              <div
                key={n}
                className={`concurrency-option ${n === value ? 'active' : ''}`}
                onClick={() => { onChange(n); setOpen(false); }}
              >
                {t('summary.concurrency', '并发')}: {n}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const SummaryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { language } = i18n;
  const toast = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel');
  const [lookbackMonths, setLookbackMonths] = useState(1);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [concurrencyLimit, setConcurrencyLimit] = useState(3);
  const { summaries, stats, missingSummaries, setMissingSummaries, queueGeneration, generationStates, refreshData } = useSummaryData();
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const currentYear = new Date().getFullYear();

  const prevStatesRef = useRef<typeof generationStates>({});

  useEffect(() => {
    const fetchActivityData = async () => {
      if (typeof window !== 'undefined' && window.electron) {
        try {
          const data = await window.electron.ipcRenderer.invoke('diary:activityData', currentYear);
          setActivityData(data || []);
        } catch (e) {
          console.warn('[SummaryPage] fetch activity data failed:', e);
        }
      }
    };
    fetchActivityData();
  }, [currentYear]);

  useEffect(() => {
    Object.keys(generationStates).forEach(uKey => {
       const cur = generationStates[uKey];
       const prev = prevStatesRef.current[uKey];
       if (cur.status === 'error' && (!prev || prev.status !== 'error')) {
           const errText = cur.error?.includes('active provider') ? t('summary.model_not_configured', '模型未配置') : (cur.error || t('common.error', '错误'));
           toast.showError(`${t('summary.generation_failed', '生成失败')}: ${errText}`);
       }
    });
    prevStatesRef.current = generationStates;
  }, [generationStates, t, toast]);

  const handleCopyContext = async () => {
    try {
      await navigator.clipboard.writeText('');
      toast.showSuccess(t('summary.toast_copied', '共同回忆已复制'));
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'));
    }
  };

  const handleBatchGenerate = async () => {
    if (isBatchGenerating) return;
    setIsBatchGenerating(true);
    
    // 找出尚未处于生成状态的项，加入待处理队列
    const pendingTasks = missingSummaries.filter(mp => {
       const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`;
       const state = generationStates[uKey];
       return !state || state.status === 'pending' || state.status === 'error';
    });

    if (pendingTasks.length > 0) {
       await queueGeneration(pendingTasks);
        toast.showSuccess(t('summary.batch_queued', '已将 $count 项任务加入后台构建队列，您可以离开页面。').replace('$count', pendingTasks.length.toString()));
    } else {
        toast.showSuccess(t('summary.all_processing', '所有检测到的遗失项均已在处理中。'));
    }

    setTimeout(() => setIsBatchGenerating(false), 800);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, height: 0, overflow: 'hidden', padding: 0, margin: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="summary-page-container">
      {/* 顶部标签栏 Chrome Style */}
      <div className="sp-header">
        <div className="sp-tabs">
          <div 
            className={`sp-tab ${activeTab === 'panel' ? 'active' : ''}`}
            onClick={() => setActiveTab('panel')}
          >
            <LayoutDashboard size={18} /> {t('summary.panel_tab', '大盘概况')}
          </div>
          <div 
            className={`sp-tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <Layers size={18} /> {t('summary.memory_gallery', '归档画廊')}
          </div>
        </div>
      </div>

      <div className="sp-content">
        {activeTab === 'panel' ? (
          <div className="sp-panel-view">
            <DashboardHeroBanner />
            
            <div className="sp-dashboard-layout">
              <DashboardSharedMemoryCard
                lookbackMonths={lookbackMonths}
                onMonthsChanged={setLookbackMonths}
                onCopyContext={handleCopyContext}
              />
              <DashboardStatsCard {...stats} />
            </div>

            {activityData.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <ActivityHeatmap data={activityData} year={currentYear} />
              </div>
            )}

            {/* AI 缺失自动检测区域 */}
            <motion.div 
              style={{ marginTop: 24 }}
              variants={containerVariants}
              initial="hidden" animate="show"
            >
               {(missingSummaries.length > 0 || stats.totalDiaryCount > 0) && (
                  <div className="sp-missing-section-title">
                     <Sparkles size={18} color="var(--color-warning)" />
                     <span>{t('summary.ai_suggestions', 'AI 建议补全')}</span>
                     
                     <button
                        className="sp-batch-generate-btn"
                        onClick={handleBatchGenerate}
                        disabled={isBatchGenerating}
                     >
                        <Sparkles size={14} />
                        {isBatchGenerating ? t('summary.generating', '生成中...') : t('summary.generate_all', '全部生成')}
                     </button>
                     
                     <ConcurrencyDropdown value={concurrencyLimit} onChange={setConcurrencyLimit} disabled={isBatchGenerating} t={t} />

                     <div className="sp-missing-count">
                        {t('common.count_items', '$count个').replace('$count', missingSummaries.length.toString())}
                     </div>
                  </div>
               )}
               
               <div className="sp-missing-grid">
                  {missingSummaries.length === 0 && stats.totalDiaryCount > 0 && (
                     <div className="sp-missing-empty">
                        {t('summary.no_missing', '暂无待合并生成')}
                     </div>
                  )}
                  <AnimatePresence>
                     {missingSummaries.map((mp: { type: string; startDate: string; endDate: string; label?: string; dateRangeStr?: string }) => {
                        const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`;
                        const isGen = !!generationStates[uKey] && generationStates[uKey].status !== 'error';
                        const progress = generationStates[uKey]?.progress || 0;

                        return (
                          <motion.div
                             key={uKey}
                             variants={itemVariants}
                             exit="exit"
                             style={{ display: 'flex' }}
                          >
                             <div className="sp-missing-card">
                                {/* 图标区域 */}
                                <div className="sp-missing-card-icon">
                                   <Calendar size={20} />
                                </div>

                                <div className="sp-missing-card-body">
                                   <div className="sp-missing-card-title">
                                      {mp.label || mp.dateRangeStr}
                                   </div>
                                   <div className="sp-missing-card-meta">
                                      <span className="sp-missing-card-date">
                                         {mp.startDate && new Date(mp.startDate).toLocaleDateString(language, { month: 'short', day: 'numeric' })}
                                         {' - '}
                                         {mp.endDate && new Date(mp.endDate).toLocaleDateString(language, { month: 'short', day: 'numeric' })}
                                      </span>
                                      <span className="sp-missing-card-badge">
                                         {t('summary.suggestion_generate', '建议生成')}
                                      </span>
                                   </div>
                                </div>

                                {/* 按钮区域 */}
                                <div>
                                  {isGen && progress < 100 ? (
                                     <div className="sp-missing-card-action processing">
                                       <style>{`@keyframes baishouSpin { 100% { transform: rotate(360deg); } }`}</style>
                                       <RefreshCw size={20} className="concurrency-trigger-icon" style={{ animation: 'baishouSpin 1.5s linear infinite' }} />
                                     </div>
                                  ) : isGen && progress >= 100 ? (
                                     <div className="sp-missing-card-action processing">
                                       <CheckCircle2 size={22} color="var(--color-success)" />
                                     </div>
                                  ) : (
                                     <div
                                       className="sp-missing-card-action"
                                       onClick={() => queueGeneration([mp])}
                                     >
                                       <Sparkles size={18} />
                                     </div>
                                  )}
                                </div>
                             </div>
                          </motion.div>
                        );
                     })}
                  </AnimatePresence>
               </div>
            </motion.div>

          </div>
        ) : (
          <GalleryPanel
            summaries={summaries}
            onOpen={(id) => navigate(`/summary/${id}`)}
            onEdit={(id) => toast.showSuccess(t('common.edit', '编辑') + ' (ID: ' + id + ')')}
            onDelete={(id) => toast.showSuccess(t('common.delete', '删除') + ' (ID: ' + id + ')')}
          />
        )}
      </div>
    </div>
  );
};

