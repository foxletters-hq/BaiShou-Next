import React, { useState, useMemo } from 'react';
import { TimelineNode, DiaryMetaCard } from '@baishou/ui';
import type { TimelineNode as TimelineNodeType } from '@baishou/shared';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './DiaryPage.css';

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<'timeline' | 'masonry'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');

  // 1:1 还原 - Mock 瀑布流/时间轴数据
  const [nodes] = useState<TimelineNodeType[]>([
    {
      id: 'sep-1',
      type: 'month_separator',
      date: new Date('2026-03-31T00:00:00Z')
    },
    {
      id: 'd-1',
      type: 'diary_entry',
      date: new Date('2026-03-31T10:00:00Z'),
      meta: {
        id: 1,
        date: new Date('2026-03-31T10:00:00Z'),
        preview: '今天的天气绝佳，阳光明媚。完成了早上的冥想和跑步，开始处理手头的 Agent 架构...',
        tags: ['日常', '工作', '冥想']
      }
    },
    {
      id: 'd-2',
      type: 'diary_entry',
      date: new Date('2026-03-30T15:30:00Z'),
      meta: {
        id: 2,
        date: new Date('2026-03-30T15:30:00Z'),
        preview: '复刻 BaiShou v3.0 的 UI 是一项庞大而精妙的工程，尤其是双端同时推进时的体验一致性考量。',
        tags: ['开发笔记', 'UI设计']
      }
    },
    {
      id: 'd-3',
      type: 'diary_entry',
      date: new Date('2026-03-29T08:00:00Z'),
      meta: {
        id: 3,
        date: new Date('2026-03-29T08:00:00Z'),
        preview: '短暂的休息日，读了一本关于图形学的书。很多关于渲染流水线的理解变得清晰了。',
        tags: ['读书', '图形学']
      }
    }
  ]);

  // Handle Search Filtering
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const lowerQ = searchQuery.toLowerCase();
    return nodes.filter(n => {
      // Month separators are kept if diaries beneath them exist (simplified here)
      if (n.type === 'month_separator') return false; 
      if (!n.meta) return false;
      const matchPreview = n.meta.preview.toLowerCase().includes(lowerQ);
      const matchTag = n.meta.tags.some(tag => tag.toLowerCase().includes(lowerQ));
      return matchPreview || matchTag;
    });
  }, [nodes, searchQuery]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  } as any;

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  } as any;

  return (
    <div className="diary-page-container">
      <header className="diary-page-header">
        <div className="dp-header-start">
          <h1 className="diary-page-title">{t('diary.title') || '我的记录'}</h1>
          <div className="dp-view-toggles">
            <button 
               className={`dp-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
               onClick={() => setViewMode('timeline')}
            >🗓️</button>
            <button 
               className={`dp-toggle-btn ${viewMode === 'masonry' ? 'active' : ''}`}
               onClick={() => setViewMode('masonry')}
            >🎨</button>
          </div>
        </div>
        
        <div className="dp-header-actions">
           <div className="dp-search-wrapper">
              <span className="dp-search-icon">🔍</span>
              <input 
                 type="text" 
                 placeholder="Search diaries... (#tag or text)"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="dp-search-input"
              />
           </div>
           <button 
              className="diary-page-add-btn" 
              onClick={() => navigate('/editor')}
           >
             + {t('diary.editor.new') || '写点什么'}
           </button>
        </div>
      </header>
      
      <div className="diary-page-content">
        <AnimatePresence mode="wait">
           {viewMode === 'timeline' ? (
              <motion.div 
                 key="timeline-view"
                 className="timeline-container"
                 variants={containerVariants}
                 initial="hidden"
                 animate="show"
                 exit="exit"
              >
                 {filteredNodes.map((node, index) => (
                    <motion.div key={`tl-${node.id}`} variants={itemVariants}>
                       <TimelineNode 
                          node={node} 
                          isLast={index === filteredNodes.length - 1} 
                          isFirst={index === 0} 
                          onDiaryClick={(id) => navigate(`/editor/${id}`)}
                       />
                    </motion.div>
                 ))}
                 {filteredNodes.length === 0 && (
                    <div className="dp-empty">{t('diary.emptySearchResult') || '没有搜到任何日记'}</div>
                 )}
              </motion.div>
           ) : (
              <motion.div 
                 key="masonry-view"
                 className="masonry-container"
                 variants={containerVariants}
                 initial="hidden"
                 animate="show"
                 exit="exit"
              >
                 {filteredNodes.filter(n => n.type === 'diary_entry').map((node) => (
                    <motion.div key={`ms-${node.id}`} variants={itemVariants} className="masonry-item">
                       <DiaryMetaCard 
                          meta={node.meta!} 
                          onClick={() => navigate(`/editor/${node.meta!.id}`)}
                       />
                    </motion.div>
                 ))}
                 {filteredNodes.length === 0 && (
                    <div className="dp-empty">{t('diary.emptySearchResult') || '没有搜到任何日记'}</div>
                 )}
              </motion.div>
           )}
        </AnimatePresence>
      </div>
    </div>
  );
};
