import React, { useState, useMemo } from 'react';
import { TimelineNode, DiaryMetaCard } from '@baishou/ui';

// 本地定义 TimelineNode 数据类型（@baishou/shared 不导出此类型）
interface TimelineNodeType {
  id: string;
  type: 'month_separator' | 'diary_entry';
  date: Date;
  meta?: { id: number; date: Date; preview: string; tags: string[] };
}
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiaryData } from './hooks/useDiaryData';
import './DiaryPage.css';

// Data correctly hydrated from real SQLite IPC pipeline

const useTranslation = (): { t: (key: string) => string } => ({
  t: (key: string) => key,
});

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'masonry'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');

  const { entries } = useDiaryData();

  const nodes = useMemo<TimelineNodeType[]>(() => {
    if (!entries || entries.length === 0) return [];
    
    // Sort descending
    const sorted = [...entries].sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    
    const newNodes: TimelineNodeType[] = [];
    let currentM = -1;
    let currentY = -1;

    sorted.forEach((e) => {
      const d = new Date(e.date || e.createdAt || Date.now());
      if (d.getMonth() !== currentM || d.getFullYear() !== currentY) {
        currentM = d.getMonth();
        currentY = d.getFullYear();
        // Add month separator
        newNodes.push({
          id: `sep-${currentY}-${currentM}`,
          type: 'month_separator',
          date: new Date(currentY, currentM, 1)
        });
      }
      newNodes.push({
        id: `d-${e.id}`,
        type: 'diary_entry',
        date: d,
        meta: { id: e.id, date: d, preview: e.content?.substring(0, 100) || t('common.no_preview', '无预览...'), tags: e.tags || [] }
      });
    });
    return newNodes;
  }, [entries]);

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Handle Search Filtering
  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const lowerQ = searchQuery.toLowerCase();
    return nodes.filter(n => {
      if (n.type === 'month_separator') return false; 
      if (!n.meta) return false;
      return n.meta.preview.toLowerCase().includes(lowerQ) || 
             n.meta.tags.some(tag => tag.toLowerCase().includes(lowerQ));
    });
  }, [nodes, searchQuery]);

  // --------------- Calendar Rendering Logic ----------------
  const generateCalendarDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
    
    let days: { dateNum: number; isCurrentMonth: boolean; fullDate: Date }[] = [];
    
    // Previous month mutable padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = 0; i < startingDayOfWeek; i++) {
       days.push({ 
          dateNum: prevMonthDays - startingDayOfWeek + i + 1, 
          isCurrentMonth: false, 
          fullDate: new Date(year, month - 1, prevMonthDays - startingDayOfWeek + i + 1)
       });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
       days.push({ 
          dateNum: i, 
          isCurrentMonth: true, 
          fullDate: new Date(year, month, i)
       });
    }

    // Next month mutable padding
    const remainingSlots = 42 - days.length; // Always render 6 rows structure to avoid jump
    for (let i = 1; i <= remainingSlots; i++) {
       days.push({ 
          dateNum: i, 
          isCurrentMonth: false, 
          fullDate: new Date(year, month + 1, i)
       });
    }

    return days;
  };

  const getDiariesForDate = (date: Date) => {
     return filteredNodes.filter(n => 
        n.type === 'diary_entry' && 
        n.date.getFullYear() === date.getFullYear() &&
        n.date.getMonth() === date.getMonth() &&
        n.date.getDate() === date.getDate()
     );
  };

  // --------------- Animation Variants ----------------
  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 350, damping: 25 } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
  };

  const calendarDays = useMemo(() => generateCalendarDays(currentMonth), [currentMonth]);
  const monthNames = [t('common.jan', '一月'), t('common.feb', '二月'), t('common.mar', '三月'), t('common.apr', '四月'), t('common.may', '五月'), t('common.jun', '六月'), t('common.jul', '七月'), t('common.aug', '八月'), t('common.sep', '九月'), t('common.oct', '十月'), t('common.nov', '十一月'), t('common.dec', '十二月')];

  return (
    <div className="diary-page-container">
      <header className="diary-page-header">
        <div className="dp-header-start">
          <h1 className="diary-page-title">
            <BookOpen size={28} color="var(--color-primary)" />
            {t('diary.title') || '星海神经带 (Diary Box)'}
          </h1>
          <div className="dp-view-toggles">
            <button 
               className={`dp-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
               onClick={() => setViewMode('calendar')}
               title={t('diary.view_calendar', '日历视图 (Calendar View)')}
            >📅</button>
            <button 
               className={`dp-toggle-btn ${viewMode === 'timeline' ? 'active' : ''}`}
               onClick={() => setViewMode('timeline')}
               title={t('diary.view_timeline', '时间轴视图 (Timeline View)')}
            >🗓️</button>
            <button 
               className={`dp-toggle-btn ${viewMode === 'masonry' ? 'active' : ''}`}
               onClick={() => setViewMode('masonry')}
               title={t('diary.view_masonry', '瀑布流视图 (Masonry View)')}
            >🎨</button>
          </div>
        </div>
        
        <div className="dp-header-actions">
           <div className="dp-search-wrapper">
              <Search size={16} className="dp-search-icon" />
              <input 
                 type="text" 
                 placeholder="Search memories... (#tags / query)"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="dp-search-input"
              />
           </div>
           <button 
              className="diary-page-add-btn" 
              onClick={() => navigate('/editor')}
           >
             <Plus size={18} /> {t('diary.editor.new') || '拓印新感知'}
           </button>
        </div>
      </header>
      
      <div className="diary-page-content">
        <AnimatePresence mode="wait">
           {viewMode === 'calendar' ? (
              <motion.div 
                 key="calendar-view"
                 className="calendar-container"
                 variants={containerVariants}
                 initial="hidden"
                 animate="show"
                 exit="exit"
              >
                  <div className="cal-header">
                     <button className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                        <ChevronLeft size={20} />
                     </button>
                     <div className="cal-title">{currentMonth.getFullYear()} - {monthNames[currentMonth.getMonth()]}</div>
                     <button className="cal-nav-btn" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                        <ChevronRight size={20} />
                     </button>
                  </div>

                  <div className="cal-grid">
                     {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="cal-day-header">{day}</div>
                     ))}
                     
                     {calendarDays.map((dayObj, idx) => {
                        const diaries = getDiariesForDate(dayObj.fullDate);
                        const isToday = dayObj.fullDate.toDateString() === new Date().toDateString();

                        return (
                           <motion.div 
                              key={`cal-c-${idx}`} 
                              variants={itemVariants}
                              className={`cal-cell ${!dayObj.isCurrentMonth ? 'cal-cell-muted' : ''} ${isToday ? 'cal-cell-today' : ''}`}
                              onClick={() => {
                                 // 点进去进入当天的瀑布流/或者直接创建当天的日记
                                 if (diaries.length > 0) {
                                    // B区扩展：导航到单篇或者切列表。为了演示，直接开编
                                    navigate(`/editor/${diaries[0].meta!.id}`);
                                 }
                              }}
                           >
                              <div className="cal-date-number">{dayObj.dateNum}</div>
                              <div className="cal-indicators">
                                 {diaries.slice(0, 3).map((_d, i) => (
                                    <div key={i} className="cal-dot"></div>
                                 ))}
                                 {diaries.length > 3 && <div style={{fontSize: 10, alignSelf:'flex-end', marginLeft: 2}}>+</div>}
                              </div>
                           </motion.div>
                        );
                     })}
                  </div>
              </motion.div>
           ) : viewMode === 'timeline' ? (
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
                          isLast={index === filteredNodes.length - 1} 
                          isFirst={index === 0} 
                       >
                         {node.type === 'month_separator' ? (
                            <div className="dp-month-sep" style={{fontWeight: 'bold', margin: '8px 0', color: 'var(--text-secondary)'}}>
                               {node.date.getFullYear()}{t('common.year_unit', '年')} {node.date.getMonth() + 1}{t('common.month_unit', '月')}
                            </div>
                         ) : (
                            <div 
                              className="dp-timeline-card" 
                              onClick={() => navigate(`/editor/${node.meta!.id}`)}
                              style={{ padding: '16px', background: 'var(--bg-glass)', borderRadius: '12px', cursor: 'pointer', marginBottom: '16px' }}
                            >
                               <div style={{fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: 8}}>
                                  {node.date.getDate()}日 {String(node.date.getHours()).padStart(2, '0')}:{String(node.date.getMinutes()).padStart(2, '0')}
                               </div>
                               <div>{node.meta!.preview}</div>
                            </div>
                         )}
                       </TimelineNode>
                    </motion.div>
                 ))}
                 {filteredNodes.length === 0 && (
                    <div className="dp-empty"><BookOpen size={48} opacity={0.3} /> {t('diary.emptySearchResult') || '未搜寻到任何历史锚点'}</div>
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
                 {filteredNodes.filter(n => n.type === 'diary_entry').map((node, _index) => (
                    <motion.div key={`ms-${node.id}`} variants={itemVariants} className="masonry-item">
                       <DiaryMetaCard 
                          meta={node.meta!} 
                          onClick={() => navigate(`/editor/${node.meta!.id}`)}
                       />
                    </motion.div>
                 ))}
                 {filteredNodes.length === 0 && (
                    <div className="dp-empty"><BookOpen size={48} opacity={0.3} /> {t('diary.emptySearchResult') || '未搜寻到任何历史锚点'}</div>
                 )}
              </motion.div>
           )}
        </AnimatePresence>
      </div>
    </div>
  );
};
