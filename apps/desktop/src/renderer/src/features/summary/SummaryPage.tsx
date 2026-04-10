import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { 
  GalleryPanel, 
  DashboardHeroBanner, DashboardStatsCard, DashboardSharedMemoryCard,
  useToast
} from '@baishou/ui';
import { motion, AnimatePresence } from 'framer-motion';
// import { useNavigate } from 'react-router-dom'; // TODO: 后续用于跳转到总结详情页
import { LayoutDashboard, Layers, Sparkles, CheckCircle2 } from 'lucide-react';
import { useSummaryData } from './hooks/useSummaryData';
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

            {/* AI 缺失自动检测区域 */}
            <motion.div 
              style={{ marginTop: 24 }}
              variants={containerVariants}
              initial="hidden" animate="show"
            >
               {missingSummaries.length > 0 && (
                  <div className="sp-missing-section-title" style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                     <svg viewBox="0 0 24 24" fill="#FFA000" width="20" height="20" style={{ marginRight: 8 }}>
                       <path d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14l-2.5 1.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
                     </svg>
                     <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{t('summary.ai_suggestions', 'AI 建议补全')}</span>
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

