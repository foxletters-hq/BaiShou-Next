import React, { useState } from 'react';
import { 
  GalleryPanel, 
  DashboardHeroBanner, DashboardStatsCard, DashboardSharedMemoryCard
} from '@baishou/ui';
import { motion, AnimatePresence } from 'framer-motion';
// import { useNavigate } from 'react-router-dom'; // TODO: 后续用于跳转到总结详情页
import { Settings, LayoutDashboard, Layers, Sparkles, CheckCircle2 } from 'lucide-react';
import { useSummaryDashboardMock } from './hooks/useSummaryDashboardMock';
import './SummaryPage.css';

// TODO: Replace with Real Translation Hook
const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

// 仿真状态机的步骤流
const GEN_PHASES = [
  '正在扫描未归档的散落记忆碎片...',
  '神经树突对接，提取时序因果...',
  '多维度交叉联想与精炼...',
  '总结流式输出并覆写入神经节...',
  '构建完成！已转入历史画廊。'
];

export const SummaryPage: React.FC = () => {
  const { t } = useTranslation();
  // const navigate = useNavigate(); // TODO: 后续用于跳转
  const { state, actions } = useSummaryDashboardMock();

  // 模拟从数据库拦截下的缺失漏洞
  const [missingPeriods, setMissingPeriods] = useState([
    { id: 'm-w-13', type: 'weekly' as const, dateRangeStr: '2026 第 13 周 (03.23-03.29)' },
    { id: 'm-m-03', type: 'monthly' as const, dateRangeStr: '2026 3月 演算特记' }
  ]);

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
             setMissingPeriods(prev => prev.filter(mp => mp.id !== id));
             const cloneGenStates = { ...generationStates };
             delete cloneGenStates[id];
             setGenerationStates(cloneGenStates);
             
             // 如果在真实世界，此时我们将调用 actions.refreshStats() 去更新顶层看板，增加汇总和生成数量
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
            className={`sp-tab ${state.activeTab === 'panel' ? 'active' : ''}`}
            onClick={() => actions.setActiveTab('panel')}
          >
            <LayoutDashboard size={18} /> {t('summary.panel_tab') || '大盘概况'}
          </div>
          <div 
            className={`sp-tab ${state.activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => actions.setActiveTab('gallery')}
          >
            <Layers size={18} /> {t('summary.memory_gallery') || '归档画廊'}
          </div>
        </div>
        <button className="sp-settings-btn" title="Summary Settings"><Settings size={18} /></button>
      </div>

      <div className="sp-content">
        {state.activeTab === 'panel' ? (
          <div className="sp-panel-view">
            <DashboardHeroBanner />
            
            <div className="sp-dashboard-layout">
              <DashboardSharedMemoryCard 
                lookbackMonths={state.lookbackMonths}
                onMonthsChanged={actions.setLookbackMonths}
                onCopyContext={actions.handleCopyContext}
              />
              <DashboardStatsCard {...state.stats} />
            </div>

            {/* AI 缺失自动检测区域 */}
            <motion.div 
              style={{ marginTop: 16 }}
              variants={containerVariants}
              initial="hidden" animate="show"
            >
               {missingPeriods.length > 0 && (
                  <div className="sp-missing-section-title">
                     <Sparkles size={18} color="var(--color-primary)" /> AI 智能探针：检索到以下周期缺乏脑图总结
                  </div>
               )}
               
               <AnimatePresence>
                  {missingPeriods.map((mp) => {
                     const isGen = !!generationStates[mp.id];
                     const progress = generationStates[mp.id]?.progress || 0;
                     const phaseLabel = generationStates[mp.id]?.phase !== undefined 
                                         ? GEN_PHASES[generationStates[mp.id].phase] 
                                         : '';

                     return (
                       <motion.div 
                          key={mp.id} 
                          variants={itemVariants}
                          exit="exit"
                          style={{ marginBottom: 16 }}
                       >
                          <div 
                            className={`sp-missing-card ${isGen ? 'is-generating' : ''}`}
                            onClick={() => {
                               // Start generation 
                               if (!isGen) startGenerationSimulation(mp.id, mp.type);
                            }}
                          >
                            <h3>
                               {isGen && progress >= 100 ? <CheckCircle2 size={18} color="var(--color-secondary)" /> : null}
                               {isGen ? `演算收束中: ${mp.dateRangeStr}` : `缺失检测: ${mp.dateRangeStr}`}
                            </h3>
                            
                            {!isGen ? (
                               <p>神经元探测到本周期的活动区块庞大且未做汇总。单击以命令您的代理启动全卷面 AI 审阅与压缩总结流水线。</p>
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
                                  <Sparkles size={14} /> 即刻激活补全协议
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
          <GalleryPanel />
        )}
      </div>
    </div>
  );
};
