import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { 
  GalleryPanel, 
  DashboardHeroBanner, DashboardStatsCard, DashboardSharedMemoryCard,
  useToast, DiaryCard
} from '@baishou/ui';
import { motion, AnimatePresence } from 'framer-motion';
// import { useNavigate } from 'react-router-dom'; // TODO: 后续用于跳转到总结详情页
import { Settings, LayoutDashboard, Layers, Sparkles, CheckCircle2 } from 'lucide-react';
import { useSummaryData } from './hooks/useSummaryData';
import { useDiaryData } from '../diary/hooks/useDiaryData';
import './SummaryPage.css';




export const SummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  // 仿真状态机的步骤流
const GEN_PHASES = [
  t('summary.step_scan', '获取游离区的所有活跃记录...'),
  t('summary.step_time', '基于时间顺序排列内容池...'),
  t('summary.step_extract', '执行跨域特征解析提纯...'),
  t('summary.step_write', 'AI 总结正流式接收生成...'),
  t('summary.step_done', '摘要归档完毕，已永久存盘。')
];
  // const navigate = useNavigate(); // TODO: 后续用于跳转
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel');
  const [lookbackMonths, setLookbackMonths] = useState(1);
  const { summaries, stats, missingSummaries, setMissingSummaries, generateSummary, refreshData } = useSummaryData();
  const { entries } = useDiaryData();
  const recentDiaries = entries.slice(0, 3);

  const handleCopyContext = async () => {
    try {
      await navigator.clipboard.writeText('');
      toast.showSuccess(t('summary.toast_copied', '共同回忆已复制'));
    } catch {
      toast.showError(t('common.copy_failed', '复制失败'));
    }
  };

  // 高强度的视觉伪态：记录每个卡片自己的生成进度和文字
  const [generationStates, setGenerationStates] = useState<Record<string, { progress: number, phase: number }>>({});

  const startGenerationSimulation = (id: string, _type: string) => {
  // 保护网：禁止重复触发同一实体
    if (generationStates[id]) return;

    setGenerationStates(prev => ({ ...prev, [id]: { progress: 0, phase: 0 } }));
    
    let currentProgress = 0;
    
    // 开辟独立时钟轨道模拟 IPC 握手
    const timer = setInterval(() => {
  currentProgress += Math.random() * 8; // 随机跳动进度以显得真实

       if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(timer);
          setGenerationStates(prev => ({ ...prev, [id]: { progress: 100, phase: GEN_PHASES.length - 1 } }));

          // 模拟成功后等待 2s，卡片销毁（表示存入数据库了）
          setTimeout(() => {
  // Let the backend handle the real generation instead of just simulating
             generateSummary(_type, 'auto').finally(() => {
  setMissingSummaries(prev => prev.filter(p => `${p.type}_${new Date(p.startDate).getTime()}` !== id));
                const cloneGenStates = { ...generationStates };
                delete cloneGenStates[id];
                setGenerationStates(cloneGenStates);
                refreshData();
             });
          }, 2000);
       } else {
          // 阶段映射 (将 0-100 映射为 4个文段)
          const phaseIdx = Math.floor((currentProgress / 100) * (GEN_PHASES.length - 1));
          setGenerationStates(prev => ({ 
             ...prev, 
             [id]: { progress: currentProgress, phase: phaseIdx } 
          }));
       }
    }, 300);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
    exit: { opacity: 0, height: 0, overflow: 'hidden', padding: 0, margin: 0, transition: { duration: 0.4 } }
  } as any;

  return (
    <div className="summary-page-container">
      {/* 顶部标签栏 Chrome Style */}
      <div className="sp-header">
        <div className="sp-tabs">
          <div 
            className={`sp-tab ${activeTab === 'panel' ? 'active' : ''}`}
            onClick={() => setActiveTab('panel')}
          >
            <LayoutDashboard size={18} /> {t('summary.panel_tab') || '大盘概况'}
          </div>
          <div 
            className={`sp-tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <Layers size={18} /> {t('summary.memory_gallery') || '归档画廊'}
          </div>
        </div>
        <button className="sp-settings-btn" title="Summary Settings"><Settings size={18} /></button>
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

            {/* 最近日记（今日记忆）预览模块 */}
            {recentDiaries && recentDiaries.length > 0 && (
              <motion.div 
                className="sp-recent-diary-section"
                variants={containerVariants}
                initial="hidden" animate="show"
                style={{ marginTop: 24, display: 'flex', flexDirection: 'column' }}
              >
                <div className="sp-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div className="sp-section-title" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t('summary.recent_diaries', '近期记录')}
                  </div>
                </div>
                <div className="sp-recent-diary-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentDiaries.map((entry: any) => (
                    <DiaryCard
                      key={entry.id}
                      id={String(entry.id)}
                      createdAt={entry.date}
                      contentSnippet={entry.preview}
                      tags={entry.tags || []}
                      onClick={() => {}}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* AI 缺失自动检测区域 */}
            <motion.div 
              style={{ marginTop: 16 }}
              variants={containerVariants}
              initial="hidden" animate="show"
            >
               {missingSummaries.length > 0 && (
                  <div className="sp-missing-section-title">
                     <Sparkles size={18} color="var(--color-primary)" /> {t('summary.probe_missing', '缺失检测系统：检测到以下时间段缺少宏观分析记录')}
                  </div>
               )}
               
               <AnimatePresence>
                  {missingSummaries.map((mp: any) => {
  const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`;
                     const isGen = !!generationStates[uKey];
                     const progress = generationStates[uKey]?.progress || 0;
                     const phaseLabel = generationStates[uKey]?.phase !== undefined 
                                         ? GEN_PHASES[generationStates[uKey].phase] 
                                         : '';

                     return (
                       <motion.div 
                          key={uKey} 
                          variants={itemVariants}
                          exit="exit"
                          style={{ marginBottom: 16 }}
                       >
                          <div 
                            className={`sp-missing-card ${isGen ? 'is-generating' : ''}`}
                            onClick={() => {


                               // Start generation 
                               if (!isGen) startGenerationSimulation(uKey, mp.type);
                            }}
                          >
                            <h3>
                               {isGen && progress >= 100 ? <CheckCircle2 size={18} color="var(--color-secondary)" /> : null}
                               {isGen ? t('summary.generating_date', '正在总结生成：{{label}}', { label: mp.label || mp.dateRangeStr }) : t('summary.missing_date', '存在空洞：{{label}}', { label: mp.label || mp.dateRangeStr })}
                            </h3>
                            
                            {!isGen ? (
                               <p>{t('summary.probe_desc', '针对这一历史段的活动，建议激活 AI 在后台完整分析并生成总结，有助于长期关联检索质量。')}</p>
                            ) : (
                               <div className="sp-generation-ui">
                                  <div className="sp-generation-status-text">
                                     <span>{phaseLabel}</span>
                                     <span>{Math.floor(progress)}%</span>
                                  </div>
                                  <div className="sp-generation-track">
                                     <div 
                                        className="sp-generation-bar" 
                                        style={{ width: `${progress}%` }} 
                                     />
                                  </div>
                               </div>
                            )}

                            {!isGen && (
                               <button className="sp-btn-generate">
                                  <Sparkles size={14} /> {t('summary.start_gen', '一键激活合并作业')}
                               </button>
                            )}
                          </div>
                       </motion.div>
                     );
                  })}
               </AnimatePresence>
            </motion.div>

          </div>
        ) : (
          <GalleryPanel summaries={summaries} />
        )}
      </div>
    </div>
  );
};

